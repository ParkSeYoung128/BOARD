/** 숫자는 천 단위 쉼표로 표기한다. (예: 1411 → 1,411) */
export function formatCount(value: number): string {
  return value.toLocaleString("ko-KR");
}
