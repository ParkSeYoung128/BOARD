import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePostInCaches } from "@/features/posts/cache";
import { ApiError } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";
import { useToast } from "@/shared/store/toast";

import { createComment, deleteComment } from "./api";
import { commentKeys } from "./keys";
import type { Comment } from "./types";

type CommentPages = InfiniteData<Page<Comment>, string | null>;

/**
 * 댓글 작성. 응답에는 글의 댓글 수가 없으므로 글 캐시(상세·목록)의 `commentCount` 를 1 올리고,
 * 댓글 목록은 다시 조회한다(새 댓글이 최신순 맨 위로 오고, 페이지 경계도 서버 기준으로 다시 맞춰진다).
 * 목록 조회가 끝날 때까지 mutation 을 대기 상태로 두어, 입력창이 그 사이 중복 등록되지 않게 한다.
 */
export function useCreateComment(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createComment(postId, content),
    onSuccess: () => {
      updatePostInCaches(queryClient, postId, (post) => ({ ...post, commentCount: post.commentCount + 1 }));
      return queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
    },
    onError: () => {
      useToast.getState().show("댓글을 등록하지 못했습니다.");
    },
  });
}

/**
 * 댓글 삭제. 이미 삭제된 댓글(404)은 원하는 결과와 같으므로 성공으로 본다.
 * 성공하면 캐시에서 바로 지우고 글의 댓글 수를 줄인 뒤 목록을 다시 조회한다.
 * 다시 조회하지 않으면 첫 페이지(2개)에서 하나가 빠졌을 때 다음 댓글이 있는데도 "더보기"가 사라질 수 있다.
 */
export function useDeleteComment(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: number) => {
      try {
        await deleteComment(commentId);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) {
          throw error;
        }
      }
    },
    onSuccess: (_result, commentId) => {
      queryClient.setQueryData<CommentPages>(commentKeys.list(postId), (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.filter((comment) => comment.id !== commentId),
                total: Math.max(0, page.total - 1),
              })),
            }
          : old,
      );
      updatePostInCaches(queryClient, postId, (post) => ({ ...post, commentCount: Math.max(0, post.commentCount - 1) }));
      return queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
    },
    onError: () => {
      useToast.getState().show("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });
}
