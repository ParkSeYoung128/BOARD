import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, assertBackendUp, createPost, deletePost, get, json } from './lib.js';

// 여러 사용자가 각자 같은 글을 연타하는 시나리오(likes.js 의 burst·sustained 는 요청마다 새 사용자라 "켜기"만 했고,
// spam 은 한 사용자뿐이었다). 서로 다른 사용자의 켜기·끄기가 같은 글 행에서 뒤섞일 때의 정합성과 지연을 본다.
//  - 사용자 MULTI_USERS 명이 각자 고정 id(multi-<VU>)로 쉬지 않고 MULTI_ROUNDS 번 토글한다(한 사람의 연타 = 연결 하나로 순차 요청).
//  - MULTI_CONN 을 2 이상으로 하면 한 사용자가 연결 여러 개로 동시에 누른다(서버 쪽 같은 사용자 직렬화, advisory lock 대기까지 겨냥).
//  - 정합성을 결정적으로 확인하려고 사용자마다 "성공한 토글 횟수의 홀짝"을 번호(VU)의 홀짝에 맞춘다.
//    사용자의 최종 상태는 횟수가 홀수면 좋아요 켜짐, 짝수면 꺼짐이므로, 끝난 뒤 글의 likeCount 는
//    "성공한 토글 수가 홀수인 사용자 수"(= likes_multi_expected_liked)와 같아야 한다.
const USERS = Number(__ENV.MULTI_USERS || 50);
const ROUNDS = Number(__ENV.MULTI_ROUNDS || 300);
const CONN = Math.max(1, Number(__ENV.MULTI_CONN || 1));

const applied = new Counter('likes_multi_applied');
const expectedLiked = new Counter('likes_multi_expected_liked');

export const options = {
  scenarios: {
    multi: {
      executor: 'per-vu-iterations',
      vus: USERS,
      iterations: 1,
      maxDuration: '5m',
    },
  },
  // 임계값은 요구사항 요구가 아니라 초기 가정이다. 측정 후 근거와 함께 조정한다. 정합성과 직결된 checks 는 100%여야 한다.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
    'http_req_duration{name:like_multi}': ['p(95)<2000'],
  },
};

export function setup() {
  assertBackendUp();
  return { postId: createPost('k6 multi spam') };
}

export default function (data) {
  const request = {
    method: 'POST',
    url: `${BASE_URL}/api/posts/${data.postId}/likes/toggle`,
    body: null,
    params: { headers: { 'x-user-id': `multi-${__VU}` }, tags: { name: 'like_multi' } },
  };

  let succeeded = 0;
  const record = (res) => {
    check(res, {
      'multi 200': (r) => r.status === 200,
      'multi likeCount 음수 아님': (r) => {
        const body = r.status === 200 ? json(r) : null;
        return body !== null && body.likeCount >= 0;
      },
    });
    if (res.status === 200) {
      succeeded += 1;
      applied.add(1);
    }
  };

  const press = () => {
    if (CONN === 1) {
      record(http.post(request.url, null, request.params));
    } else {
      http.batch(Array.from({ length: CONN }, () => request)).forEach(record);
    }
  };

  for (let round = 0; round < ROUNDS; round += 1) {
    press();
  }

  // 계획한 총 횟수(ROUNDS * CONN)의 홀짝을 VU 번호의 홀짝에 맞추려고, 모자라면 한 번 더 누른다.
  const extra = (((__VU % 2) - ((ROUNDS * CONN) % 2)) + 2) % 2;
  if (extra === 1) {
    record(http.post(request.url, null, request.params));
  }

  // 실제로 성공한 횟수 기준으로 기대 상태를 센다(요청이 실패했다면 그만큼 기대값도 달라진다).
  if (succeeded % 2 === 1) {
    expectedLiked.add(1);
  }
}

// 정합성 확인용 출력. likeCount 는 요약의 likes_multi_expected_liked 와 같아야 한다(요청이 모두 성공했다면 USERS 의 절반 올림).
export function teardown(data) {
  const res = get('verify', `/posts/${data.postId}`, 'k6-owner');
  const body = res.status === 200 ? json(res) : null;
  console.log(
    `[검증] multi: 글 id=${data.postId}, 최종 likeCount=${body ? body.likeCount : '조회 실패'}, ` +
      `설계상 기대값(전부 성공 시)=${Math.ceil(USERS / 2)}, 사용자=${USERS}, 사용자당 라운드=${ROUNDS}, 연결=${CONN}`,
  );
  deletePost(data.postId);
}
