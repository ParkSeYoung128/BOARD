/** 댓글. 명세의 Comment 필드 그대로이며, 본인 여부 표시는 없어 `author` 를 현재 사용자와 비교해 판단한다. */
export type Comment = {
  id: number;
  postId: number;
  content: string;
  author: string;
  createdAt: string;
};
