/** 주소의 `[id]` 를 양의 정수로 바꾼다. 숫자가 아니거나 안전한 정수 범위를 벗어나면 null(서버에 묻지 않고 "없는 글"로 처리). */
export function parsePostId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isSafeInteger(id) && id >= 1 ? id : null;
}
