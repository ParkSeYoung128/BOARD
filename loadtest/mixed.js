import { check, sleep } from 'k6';
import {
  assertBackendUp,
  createPost,
  deletePost,
  fetchLivePosts,
  get,
  json,
  post,
  randomInt,
  randomItem,
  walkPages,
} from './lib.js';

// 시나리오: 실제 사용에 가까운 혼합 트래픽.
//  읽기 55% (목록 + 상세) / 댓글 읽기 20% / 좋아요 15% / 댓글 작성 10%
// 쓰기는 모두 이 테스트가 만든 전용 글에만 해서 시드 데이터를 건드리지 않는다.
const PEAK = Number(__ENV.VUS || 100);
const HOLD = __ENV.HOLD || '2m';
const USERS = Number(__ENV.USERS || 300);
const SANDBOX_POSTS = 5;

export const options = {
  scenarios: {
    mixed: {
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
    'http_req_duration{name:feed_list}': ['p(95)<500'],
    'http_req_duration{name:post_detail}': ['p(95)<500'],
    'http_req_duration{name:comments_first}': ['p(95)<500'],
    'http_req_duration{name:like_toggle}': ['p(95)<800'],
    'http_req_duration{name:comment_create}': ['p(95)<800'],
  },
};

export function setup() {
  assertBackendUp();
  const posts = fetchLivePosts();
  if (posts.length === 0) {
    throw new Error('게시글이 없다. 시드가 적재되었는지 확인한다.');
  }
  const busiest = posts.reduce((a, b) => (b.commentCount > a.commentCount ? b : a), posts[0]);
  const sandbox = [];
  for (let i = 0; i < SANDBOX_POSTS; i++) {
    sandbox.push(createPost(`k6 sandbox ${i + 1}`));
  }
  return { ids: posts.map((p) => p.id), busiest: busiest.id, sandbox };
}

export default function (data) {
  const roll = Math.random();
  const user = `k6-user-${randomInt(USERS)}`;

  if (roll < 0.55) {
    const walked = walkPages('feed_list', '/posts', 20, 2, user);
    check(walked, { 'feed 순회 성공': (w) => w.ok });
    const detail = get('post_detail', `/posts/${randomItem(data.ids)}`, user);
    check(detail, { 'detail 200': (r) => r.status === 200 });
  } else if (roll < 0.75) {
    const path = `/posts/${data.busiest}/comments`;
    const first = get('comments_first', `${path}?limit=2`, user);
    check(first, { 'comments 200': (r) => r.status === 200 });
    const body = first.status === 200 ? json(first) : null;
    if (body && body.nextCursor && Math.random() < 0.3) {
      const more = get('comments_more', `${path}?limit=20&cursor=${encodeURIComponent(body.nextCursor)}`, user);
      check(more, { 'more 200': (r) => r.status === 200 });
    }
  } else if (roll < 0.9) {
    const res = post('like_toggle', `/posts/${randomItem(data.sandbox)}/likes/toggle`, undefined, user);
    check(res, { 'like 200': (r) => r.status === 200 });
  } else {
    const content = `k6 댓글 ${__VU}-${__ITER}`;
    const res = post('comment_create', `/posts/${randomItem(data.sandbox)}/comments`, { content }, user);
    check(res, { 'comment 201': (r) => r.status === 201 });
  }

  sleep(0.3 + Math.random() * 0.7);
}

export function teardown(data) {
  data.sandbox.forEach((id) => deletePost(id));
}
