import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { Page } from "@/shared/api/types";

import { postKeys } from "./keys";
import type { Post } from "./types";

type PostPages = InfiniteData<Page<Post>, string | null>;

/** 목록 캐시에서 글 하나를 찾는다(상세의 placeholder 용). */
export function findPostInList(queryClient: QueryClient, id: number): Post | undefined {
  return queryClient
    .getQueryData<PostPages>(postKeys.list())
    ?.pages.flatMap((page) => page.items)
    .find((post) => post.id === id);
}

/**
 * 같은 글이 들어 있는 모든 캐시(상세·목록)에 같은 변경을 반영한다.
 * 두 캐시가 갈라지면 상세에서 누른 좋아요가 뒤로가기 후 목록에 반영되지 않는 문제가 생기므로 항상 이 함수로만 고친다.
 * 캐시에 없는 쪽은 건드리지 않는다.
 */
export function updatePostInCaches(queryClient: QueryClient, id: number, update: (post: Post) => Post) {
  queryClient.setQueryData<Post>(postKeys.detail(id), (old) => (old ? update(old) : old));
  queryClient.setQueryData<PostPages>(postKeys.list(), (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === id ? update(post) : post)),
          })),
        }
      : old,
  );
}
