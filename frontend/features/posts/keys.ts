/** 쿼리 키를 한 곳에 모아 화면마다 문자열을 직접 쓰다 생기는 오타를 막는다. */
export const postKeys = {
  all: ["posts"] as const,
  list: () => [...postKeys.all, "list"] as const,
  detail: (id: number) => [...postKeys.all, "detail", id] as const,
  /** mutation 키. 같은 글의 좋아요 요청이 몇 개 진행 중인지 세는 데 쓴다. */
  like: (id: number) => [...postKeys.all, "like", id] as const,
};
