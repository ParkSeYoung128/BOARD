export const DEFAULT_USER_ID = "demo_user";
const COOKIE_NAME = "x-user-id";

/**
 * 현재 사용자(요청자) id. 서버가 요청자를 정하는 규칙(쿠키 값을 URL 디코딩하고 앞뒤 공백을 제거, 비어 있으면 기본값)과 같게 읽는다.
 * 글·댓글 응답에는 "내 것" 표시가 없고 `author` 만 있으므로, 이 값과 비교해 본인 여부를 판단한다.
 * 서버 렌더링 중에는 쿠키가 없어 기본값을 돌려주지만, 이 값을 쓰는 화면은 데이터를 클라이언트에서 불러온 뒤에만 그려서 불일치가 생기지 않는다.
 */
export function getCurrentUserId(cookieString?: string): string {
  const source = cookieString ?? (typeof document === "undefined" ? "" : document.cookie);
  for (const part of source.split(";")) {
    const entry = part.trim();
    if (!entry.startsWith(`${COOKIE_NAME}=`)) {
      continue;
    }
    const raw = entry.slice(COOKIE_NAME.length + 1);
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // 잘못된 인코딩이면 원문을 그대로 쓴다(서버도 해석하지 못하면 원문을 기준으로 한다).
    }
    return value.trim() || DEFAULT_USER_ID;
  }
  return DEFAULT_USER_ID;
}
