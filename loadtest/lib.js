import http from 'k6/http';

// 모든 시나리오가 공유하는 도우미. 요청마다 name 태그를 붙여 URL(커서·id)이 달라도 한 항목으로 집계한다.
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
const API = `${BASE_URL}/api`;

// 부하 테스트 데이터(전용 글)를 만들고 지우는 사용자
export const OWNER = 'k6-owner';

function params(name, user, withBody) {
  const headers = { 'x-user-id': user };
  if (withBody) {
    headers['Content-Type'] = 'application/json';
  }
  return { headers, tags: { name } };
}

export function get(name, path, user = 'k6-reader') {
  return http.get(`${API}${path}`, params(name, user, false));
}

export function post(name, path, body, user = 'k6-reader') {
  const hasBody = body !== undefined;
  return http.post(`${API}${path}`, hasBody ? JSON.stringify(body) : null, params(name, user, hasBody));
}

export function del(name, path, user) {
  return http.del(`${API}${path}`, null, params(name, user, false));
}

export function json(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

export function randomInt(bound) {
  return Math.floor(Math.random() * bound);
}

export function randomItem(list) {
  return list[randomInt(list.length)];
}

export function assertBackendUp() {
  const res = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  if (res.status !== 200) {
    throw new Error(`백엔드가 응답하지 않는다: ${BASE_URL}/health -> ${res.status}`);
  }
}

export function fetchLivePosts() {
  const res = get('setup_list', '/posts?limit=50', OWNER);
  if (res.status !== 200) {
    throw new Error(`게시글 목록 조회 실패: ${res.status} ${res.body}`);
  }
  return json(res).items;
}

export function createPost(title) {
  const res = post('setup_create', '/posts', { title, content: 'k6 부하 테스트용 게시글' }, OWNER);
  if (res.status !== 201) {
    throw new Error(`게시글 생성 실패: ${res.status} ${res.body}`);
  }
  return json(res).id;
}

export function deletePost(id) {
  del('teardown_delete', `/posts/${id}`, OWNER);
}

// 커서를 따라 최대 maxPages 페이지를 순서대로 조회한다. 마지막 페이지(nextCursor=null)면 멈춘다.
// ok: 모든 요청이 200 이었는지. complete: 마지막 페이지까지 실제로 도달했는지.
// 상한(maxPages)에 걸려 nextCursor 가 남은 채 멈추면 ok 는 true 여도 complete 는 false 다.
export function walkPages(name, path, limit, maxPages, user) {
  let cursor = null;
  let pages = 0;
  let complete = false;
  while (pages < maxPages) {
    const query = `limit=${limit}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
    const res = get(name, `${path}?${query}`, user);
    const body = res.status === 200 ? json(res) : null;
    if (!body) {
      return { pages, ok: false, complete: false };
    }
    pages += 1;
    if (!body.nextCursor) {
      complete = true;
      break;
    }
    cursor = body.nextCursor;
  }
  return { pages, ok: true, complete };
}
