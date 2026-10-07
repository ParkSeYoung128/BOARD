import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { assertBackendUp, createPost, deletePost, get, json, post } from './lib.js';

// 좋아요 동시성 시나리오. 각 시나리오는 전용 글을 쓰므로 시드 데이터를 건드리지 않고, 끝난 뒤 정합성을 확인할 수 있다.
//  - burst    : 서로 다른 사용자 수백 명이 한꺼번에 같은 글에 좋아요(핫 로우 락 경합, 커넥션 풀 대기)
//  - sustained: 서로 다른 사용자가 일정 시간 쉬지 않고 같은 글에 좋아요(처리량 한계)
//  - spam     : 한 사용자가 여러 연결로 같은 글을 연타(같은 사용자 직렬화, advisory lock 대기)
const BURST = Number(__ENV.BURST || 500);
const BURST_VUS = Math.min(BURST, Number(__ENV.VUS || 200));
const SUSTAINED_VUS = Number(__ENV.SUSTAINED_VUS || 100);
const SUSTAINED_SECONDS = Number(__ENV.SUSTAINED_SECONDS || 30);
const SPAM_VUS = Number(__ENV.SPAM_VUS || 10);
const SPAM_SECONDS = Number(__ENV.SPAM_SECONDS || 20);

// 앞 시나리오가 끝나고 정리될 시간을 두고 순서대로 시작한다.
const SUSTAINED_START = 70;
const SPAM_START = SUSTAINED_START + SUSTAINED_SECONDS + 30;

const burstApplied = new Counter('likes_burst_applied');
const sustainedApplied = new Counter('likes_sustained_applied');
const spamApplied = new Counter('likes_spam_applied');

export const options = {
  scenarios: {
    burst: {
      executor: 'shared-iterations',
      exec: 'burst',
      vus: BURST_VUS,
      iterations: BURST,
      maxDuration: '60s',
    },
    sustained: {
      executor: 'constant-vus',
      exec: 'sustained',
      vus: SUSTAINED_VUS,
      duration: `${SUSTAINED_SECONDS}s`,
      startTime: `${SUSTAINED_START}s`,
    },
    spam: {
      executor: 'constant-vus',
      exec: 'spam',
      vus: SPAM_VUS,
      duration: `${SPAM_SECONDS}s`,
      startTime: `${SPAM_START}s`,
    },
  },
  // 임계값은 요구사항 요구가 아니라 초기 가정이다. 측정 후 근거와 함께 조정한다.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:like_burst}': ['p(95)<1500'],
    'http_req_duration{name:like_sustained}': ['p(95)<1000'],
    'http_req_duration{name:like_spam}': ['p(95)<500'],
  },
};

export function setup() {
  assertBackendUp();
  return {
    posts: {
      burst: createPost('k6 burst'),
      sustained: createPost('k6 sustained'),
      spam: createPost('k6 spam'),
    },
  };
}

function toggle(name, postId, user) {
  return post(name, `/posts/${postId}/likes/toggle`, undefined, user);
}

function appliedLike(res) {
  const body = res.status === 200 ? json(res) : null;
  return body !== null && body.isLiked === true;
}

export function burst(data) {
  const res = toggle('like_burst', data.posts.burst, `burst-${__VU}-${__ITER}`);
  if (check(res, { 'burst 좋아요 반영': appliedLike })) {
    burstApplied.add(1);
  }
}

export function sustained(data) {
  const res = toggle('like_sustained', data.posts.sustained, `sustained-${__VU}-${__ITER}`);
  if (check(res, { 'sustained 좋아요 반영': appliedLike })) {
    sustainedApplied.add(1);
  }
}

export function spam(data) {
  const res = toggle('like_spam', data.posts.spam, 'k6-spammer');
  if (check(res, { 'spam 200': (r) => r.status === 200 })) {
    spamApplied.add(1);
  }
}

// 정합성 확인용 출력. likeCount(= 시작 0 + 반영된 좋아요 수)가 위 카운터와 일치해야 한다.
//  burst·sustained: likeCount == likes_*_applied
//  spam: 한 사용자의 토글은 켜짐/꺼짐이 번갈아 나오므로 likeCount == likes_spam_applied % 2
export function teardown(data) {
  Object.keys(data.posts).forEach((key) => {
    const id = data.posts[key];
    const res = get('verify', `/posts/${id}`, 'k6-owner');
    const body = res.status === 200 ? json(res) : null;
    console.log(`[검증] ${key}: 글 id=${id}, 최종 likeCount=${body ? body.likeCount : '조회 실패'}`);
    deletePost(id);
  });
}
