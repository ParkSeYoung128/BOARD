export const AVATAR_COUNT = 3;

/** 작성자명으로 아바타를 고정 선택한다(같은 작성자는 항상 같은 이미지). 반환값은 1~3. */
export function avatarIndex(author: string): number {
  let sum = 0;
  for (const char of author) {
    sum += char.codePointAt(0) ?? 0;
  }
  return (sum % AVATAR_COUNT) + 1;
}

export function avatarSrc(author: string): string {
  return `/avatar-${avatarIndex(author)}.png`;
}
