import { check, sleep } from 'k6';
import { assertBackendUp, fetchLivePosts, get, json, walkPages } from './lib.js';

// 시나리오: 댓글이 가장 많은 글(시드 기준 약 1,400개).
//  - first_view: 화면과 같은 방식. 첫 요청 limit=2, "더보기"로 cursor + limit=20
//  - deep_walk : 끝까지 limit=50 으로 순회(커서 페이지네이션이 깊은 곳에서도 일정한지 확인)
const VUS = Number(__ENV.VUS || 40);
const SECONDS = Number(__ENV.SECONDS || 60);
const MIN_COMMENTS = Number(__ENV.MIN_COMMENTS || 1000);

export const options = {
  scenarios: {
    first_view: { executor: 'constant-vus', exec: 'firstView', vus: VUS, duration: `${SECONDS}s` },
    deep_walk: {
      executor: 'constant-vus',
      exec: 'deepWalk',
      vus: Math.max(1, Math.floor(VUS / 5)),
      duration: `${SECONDS}s`,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:comments_first}': ['p(95)<300'],
    'http_req_duration{name:comments_more}': ['p(95)<300'],
    'http_req_duration{name:comments_walk}': ['p(95)<300'],
  },
};

export function setup() {
  assertBackendUp();
  const posts = fetchLivePosts();
  const busiest = posts.reduce((a, b) => (b.commentCount > a.commentCount ? b : a), posts[0]);
  if (!busiest || busiest.commentCount < MIN_COMMENTS) {
    throw new Error(
      `댓글이 ${MIN_COMMENTS}개 이상인 글이 없다(최대 ${busiest ? busiest.commentCount : 0}). 시드가 적재되었는지 확인한다.`,
    );
  }
  console.log(`대상 글 id=${busiest.id}, 댓글 ${busiest.commentCount}개`);
  return { postId: busiest.id };
}

export function firstView(data) {
  const user = `k6-reader-${__VU}`;
  const path = `/posts/${data.postId}/comments`;

  const first = get('comments_first', `${path}?limit=2`, user);
  const body = first.status === 200 ? json(first) : null;
  check(first, { 'first 200': (r) => r.status === 200 });

  if (body && body.nextCursor) {
    const more = get('comments_more', `${path}?limit=20&cursor=${encodeURIComponent(body.nextCursor)}`, user);
    check(more, { 'more 200': (r) => r.status === 200 });
  }
  sleep(0.5 + Math.random());
}

export function deepWalk(data) {
  const walked = walkPages('comments_walk', `/posts/${data.postId}/comments`, 50, 100, `k6-walker-${__VU}`);
  check(walked, { 'walk 성공': (w) => w.ok, '끝까지 순회': (w) => w.complete });
  sleep(1);
}
