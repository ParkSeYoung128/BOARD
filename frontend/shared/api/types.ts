/** 목록 API 공통 봉투. `nextCursor` 는 불투명 문자열이며, 마지막 페이지면 null 이다. */
export type Page<T> = {
  items: T[];
  total: number;
  nextCursor: string | null;
};
