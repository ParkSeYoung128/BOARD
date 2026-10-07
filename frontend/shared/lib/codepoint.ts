/**
 * 글자 수는 서버(Java `codePointCount`)와 같은 코드포인트 기준으로 센다. 이모지 하나는 1자다.
 * 결합 이모지(👨‍👩‍👧 등)는 화면에서는 1자로 보여도 여러 코드포인트로 센다. 서버와의 일치를 우선해
 * 사용자가 보는 글자(grapheme) 기준은 쓰지 않는다.
 */
export function countCodePoints(value: string): number {
  let count = 0;
  for (const _ of value) {
    count += 1;
  }
  return count;
}

/** 코드포인트 기준으로 max 자까지만 남긴다. UTF-16 로 자르지 않으므로 이모지가 반으로 쪼개지지 않는다. */
export function truncateCodePoints(value: string, max: number): string {
  if (max <= 0) {
    return "";
  }
  let result = "";
  let count = 0;
  for (const char of value) {
    if (count >= max) {
      break;
    }
    result += char;
    count += 1;
  }
  return result;
}
