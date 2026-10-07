import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPosts } from "./api";

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ items: [], total: 0, nextCursor: null }))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchPosts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("인자가 없으면 쿼리 문자열 없이 /posts 를 호출한다", async () => {
    const fetchMock = stubFetch();
    await fetchPosts();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/posts$/);
  });

  it("cursor 와 limit 를 쿼리로 붙이고 cursor 는 인코딩한다", async () => {
    const fetchMock = stubFetch();
    await fetchPosts({ cursor: "a+b/c=", limit: 5 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("cursor")).toBe("a+b/c=");
  });
});
