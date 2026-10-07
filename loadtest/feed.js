import { check, sleep } from 'k6';
import { assertBackendUp, fetchLivePosts, get, randomItem, walkPages } from './lib.js';

// 시나리오: 목록 keyset 순회(limit=20) + 상세 조회. 읽기 중심 트래픽.
const PEAK = Number(__ENV.VUS || 50);
const HOLD = __ENV.HOLD || '1m';

export const options = {
  scenarios: {
    feed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PEAK },
        { duration: HOLD, target: PEAK },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  // 임계값은 요구사항 요구가 아니라 초기 가정이다. 측정 후 근거와 함께 조정한다.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:feed_list}': ['p(95)<300'],
    'http_req_duration{name:post_detail}': ['p(95)<300'],
  },
};

export function setup() {
  assertBackendUp();
  const posts = fetchLivePosts();
  if (posts.length === 0) {
    throw new Error('게시글이 없다. 시드가 적재되었는지 확인한다.');
  }
  return { ids: posts.map((p) => p.id) };
}

export default function (data) {
  const user = `k6-reader-${__VU}`;
  const walked = walkPages('feed_list', '/posts', 20, 5, user);
  check(walked, { 'feed 순회 성공': (w) => w.ok });

  const detail = get('post_detail', `/posts/${randomItem(data.ids)}`, user);
  check(detail, { 'detail 200': (r) => r.status === 200 });

  sleep(0.5 + Math.random());
}
