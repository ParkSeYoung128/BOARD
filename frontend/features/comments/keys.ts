/**
 * 댓글 쿼리 키. 글 키(`['posts', …]`) 밖에 둔다.
 * 좋아요가 `postKeys.all` 을 취소·무효화해도 댓글 목록(커서 페이지)이 함께 흔들리지 않게 하려는 분리다.
 */
export const commentKeys = {
  all: ["comments"] as const,
  list: (postId: number) => [...commentKeys.all, postId] as const,
};
