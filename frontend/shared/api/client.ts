/** 서버가 내려주는 오류 본문 `{ code, message }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api").replace(/\/+$/, "");

/**
 * 백엔드 호출 공통 함수. 브라우저가 직접 호출하므로 `credentials: "include"`로 `x-user-id` 쿠키를 함께 보낸다.
 * (쿠키는 포트를 구분하지 않아 localhost:3000 에서 설정한 쿠키가 localhost:8080 에도 전송된다.)
 * 본문이 있을 때만 Content-Type 을 붙여, 조회(GET)가 불필요한 CORS 사전 요청을 만들지 않게 한다.
 */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (error) {
    // 호출한 쪽이 취소한 요청(화면 이탈 등)은 네트워크 장애가 아니므로 그대로 던져 쿼리 라이브러리가 취소로 처리하게 한다.
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, "NETWORK_ERROR", "서버에 연결할 수 없습니다.");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  let payload: unknown;
  let parsed = true;
  try {
    payload = await response.json();
  } catch {
    parsed = false;
  }
  if (!response.ok) {
    const error = (parsed && payload && typeof payload === "object" ? payload : {}) as { code?: string; message?: string };
    throw new ApiError(response.status, error.code ?? "UNKNOWN", error.message ?? "요청을 처리하지 못했습니다.");
  }
  if (!parsed) {
    throw new ApiError(response.status, "INVALID_RESPONSE", "서버 응답을 해석하지 못했습니다.");
  }
  return payload as T;
}
