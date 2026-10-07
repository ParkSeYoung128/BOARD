import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchPost, fetchPosts } from "./api";
import { findPostInList } from "./cache";
import { postKeys } from "./keys";
import type { Post } from "./types";

export { postKeys } from "./keys";

export function usePostList() {
  return useInfiniteQuery({
    queryKey: postKeys.list(),
    queryFn: ({ pageParam, signal }) => fetchPosts({ cursor: pageParam, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * 게시글 상세. 목록에서 들어왔다면 목록 캐시의 같은 글을 먼저 보여 주고(목록 항목과 상세 응답이 같은 객체),
 * 그 사이 서버에서 최신 값을 불러온다. placeholder 는 캐시에 저장되지 않으므로 `isPlaceholderData` 로 구분한다.
 */
export function usePost(id: number) {
  const queryClient = useQueryClient();
  return useQuery<Post>({
    queryKey: postKeys.detail(id),
    queryFn: ({ signal }) => fetchPost(id, signal),
    placeholderData: () => findPostInList(queryClient, id),
  });
}
