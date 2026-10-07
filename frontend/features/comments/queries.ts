import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchComments } from "./api";
import { commentKeys } from "./keys";

/** 처음에는 2개만 보여 주고, "더보기" 이후에는 20개씩 이어서 불러온다(명세). */
export const FIRST_PAGE_SIZE = 2;
export const NEXT_PAGE_SIZE = 20;

/**
 * 댓글 목록(최신순, 커서 방식). 페이지 크기를 요청 파라미터(커서 유무)로 정하므로,
 * 댓글을 쓰거나 지운 뒤 모든 페이지를 다시 조회해도 첫 페이지는 계속 2개, 나머지는 20개 단위로 같은 모양이 유지된다.
 */
export function useComments(postId: number) {
  return useInfiniteQuery({
    queryKey: commentKeys.list(postId),
    queryFn: ({ pageParam, signal }) =>
      fetchComments({ postId, cursor: pageParam, limit: pageParam ? NEXT_PAGE_SIZE : FIRST_PAGE_SIZE, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
