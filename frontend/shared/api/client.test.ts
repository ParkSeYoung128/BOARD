import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./client";

function respond(body: string | null, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("오류가 발생해야 한다");
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("성공 응답의 JSON 본문을 그대로 반환한다", async () => {
    respond(JSON.stringify({ items: [], total: 0, nextCursor: null }));
    await expect(apiFetch("/posts")).resolves.toEqual({ items: [], total: 0, nextCursor: null });
  });

  it("유효한 JSON 값 null 은 파싱 실패가 아니므로 그대로 반환한다", async () => {
    respond("null");
    await expect(apiFetch("/posts")).resolves.toBeNull();
  });

  it("204 는 본문 없이 undefined 를 반환한다", async () => {
    respond(null, 204);
    await expect(apiFetch("/posts/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("성공 상태인데 본문이 JSON 이 아니면 INVALID_RESPONSE 로 실패한다", async () => {
    respond("<html>gateway</html>");
    const error = await catchError(apiFetch("/posts"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(200);
    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("오류 응답은 서버의 code·message 를 ApiError 로 옮긴다", async () => {
    respond(JSON.stringify({ code: "POST_NOT_FOUND", message: "게시글이 없습니다." }), 404);
    const error = await catchError(apiFetch("/posts/9"));
    expect(error).toMatchObject({ status: 404, code: "POST_NOT_FOUND", message: "게시글이 없습니다." });
  });

  it("오류 응답 본문이 JSON 이 아니면 UNKNOWN 과 기본 메시지를 쓴다", async () => {
    respond("Bad Gateway", 502);
    const error = await catchError(apiFetch("/posts"));
    expect(error).toMatchObject({ status: 502, code: "UNKNOWN", message: "요청을 처리하지 못했습니다." });
  });

  it("네트워크 오류는 status 0 의 NETWORK_ERROR 로 바꾼다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await catchError(apiFetch("/posts"));
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("본문이 있을 때만 Content-Type 을 보내고 쿠키를 포함한다", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/posts");
    await apiFetch("/posts", { method: "POST", body: { title: "a" } });

    const [, getInit] = fetchMock.mock.calls[0];
    const [, postInit] = fetchMock.mock.calls[1];
    expect(getInit.headers).toBeUndefined();
    expect(getInit.credentials).toBe("include");
    expect(postInit.headers).toEqual({ "Content-Type": "application/json" });
    expect(postInit.body).toBe(JSON.stringify({ title: "a" }));
  });

  it("signal 을 fetch 에 넘기고, 취소된 요청은 NETWORK_ERROR 로 바꾸지 않는다", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const fetchMock = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(abortError);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/posts", { signal: controller.signal })).rejects.toBe(abortError);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
