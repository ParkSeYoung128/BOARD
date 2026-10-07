/** 게시글. 목록 항목과 상세 응답이 같은 객체라 하나의 타입을 함께 쓴다(좋아요 결과를 두 캐시에 같은 방식으로 반영하기 위해). */
export type Post = {
  id: number;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  author: string;
  createdAt: string;
};
