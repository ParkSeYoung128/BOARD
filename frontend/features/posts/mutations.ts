import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api/client";
import { useToast } from "@/shared/store/toast";

import { createPost, deletePost, type PostInput, toggleLike, updatePost } from "./api";
import { findPostInList, updatePostInCaches } from "./cache";
import { postKeys } from "./keys";
import type { Post } from "./types";

type LikeState = Pick<Post, "isLiked" | "likeCount">;

/**
 * 글별로 서버가 마지막으로 확정한 좋아요 상태. 연타가 시작될 때의 값으로 시작해 응답이 올 때마다 갱신한다.
 * 실패했을 때 "어디로 되돌릴지"의 기준이다. 요청 직전 스냅샷 하나를 복원하면 연타 중 앞선 성공까지 취소하게 된다.
 */
const confirmedLikes = new WeakMap<QueryClient, Map<number, LikeState>>();

function confirmedOf(queryClient: QueryClient) {
  let confirmed = confirmedLikes.get(queryClient);
  if (!confirmed) {
    confirmed = new Map();
    confirmedLikes.set(queryClient, confirmed);
  }
  return confirmed;
}

/** 기준 상태에 토글을 `count` 번 얹은 결과(짝수 번이면 제자리, 홀수 번이면 한 번 뒤집은 상태). */
function withToggles(base: LikeState, count: number): LikeState {
  if (count % 2 === 0) {
    return base;
  }
  return { isLiked: !base.isLiked, likeCount: Math.max(0, base.likeCount + (base.isLiked ? -1 : 1)) };
}

/**
 * 좋아요 토글.
 * - 누르는 즉시 하트와 숫자를 바꾸고(낙관적), 서버가 확정한 `{ isLiked, likeCount }` 로 상세·목록 캐시를 덮어쓴다.
 *   덧셈·뺄셈을 클라이언트가 이어가지 않고 서버 값을 기준으로 삼아, 다른 사용자의 좋아요가 섞여도 어긋나지 않는다.
 * - 같은 글의 요청은 `scope` 로 순서대로 한 번에 하나씩 보낸다(연타해도 서버가 누른 순서대로 처리).
 * - 연타 중에는 마지막 응답만 화면에 반영한다. 앞선 응답이 도착할 때마다 덮어쓰면 하트가 깜빡인다.
 * - 진행 중인 재조회는 시작 전에 취소한다. 낙관적 값 위에 오래된 응답이 덮어쓰는 것을 막는다.
 * - 실패하면 "마지막 서버 확정 값 + 아직 남은 토글"로 되돌린 뒤 재조회한다. 서버 장애로 재조회까지 실패해도
 *   낙관적 값이 남지 않고, 연타 중 앞선 성공은 취소되지 않는다.
 */
export function useToggleLike(postId: number) {
  const queryClient = useQueryClient();
  const mutationKey = postKeys.like(postId);
  // 콜백이 실행되는 동안 현재 요청도 진행 중으로 센다. 1 이하이면 뒤따르는 요청이 없는 마지막 요청이다.
  const pendingCount = () => queryClient.isMutating({ mutationKey });

  return useMutation({
    mutationKey,
    scope: { id: `post-like-${postId}` },
    mutationFn: () => toggleLike(postId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKeys.all });
      const current = queryClient.getQueryData<Post>(postKeys.detail(postId)) ?? findPostInList(queryClient, postId);
      if (current && pendingCount() <= 1) {
        // 연타의 첫 요청: 지금 보이는 값이 서버가 마지막으로 확정한 값이다.
        confirmedOf(queryClient).set(postId, { isLiked: current.isLiked, likeCount: current.likeCount });
      }
      updatePostInCaches(queryClient, postId, (post) => ({ ...post, ...withToggles(post, 1) }));
    },
    onSuccess: (result) => {
      confirmedOf(queryClient).set(postId, result);
      if (pendingCount() <= 1) {
        updatePostInCaches(queryClient, postId, (post) => ({ ...post, ...result }));
      }
    },
    onError: () => {
      useToast.getState().show("좋아요를 처리하지 못했습니다.");
      const remaining = Math.max(0, pendingCount() - 1);
      const confirmed = confirmedOf(queryClient).get(postId);
      if (confirmed) {
        updatePostInCaches(queryClient, postId, (post) => ({ ...post, ...withToggles(confirmed, remaining) }));
      }
      if (remaining === 0) {
        void queryClient.invalidateQueries({ queryKey: postKeys.all });
      }
    },
  });
}

/**
 * 게시글 삭제. 이미 삭제된 글(404)은 원하던 결과와 같으므로 성공으로 본다.
 * 목록은 비워 두어(이동한 목록 화면이 첫 페이지부터 다시 불러온다) 삭제한 글이 잠깐 남는 일이 없게 하고,
 * 상세 캐시는 지우지 않고 오래된 것으로만 표시한다(지우면 화면이 남아 있는 동안 다시 불러와 404 화면이 번쩍인다).
 */
export function useDeletePost(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await deletePost(postId);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), refetchType: "none" });
      void queryClient.resetQueries({ queryKey: postKeys.list() });
    },
  });
}

/**
 * 글 작성. 성공하면 목록 캐시를 비워(`resetQueries`) 다음에 목록을 열 때 새로 불러오게 한다.
 * 이미 여러 페이지를 불러둔 목록에 새 글을 끼워 넣는 대신 처음부터 다시 받는 쪽이, 최신순 맨 위에 새 글이 오는 것을 서버 기준으로 보장한다.
 * (작성 화면에 있는 동안 목록 쿼리는 비활성이라 이 호출은 캐시만 비우고, 요청은 목록이 다시 열릴 때 나간다.)
 * 토스트와 화면 이동은 화면(컴포넌트)이 맡는다.
 */
export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => queryClient.resetQueries({ queryKey: postKeys.list() }),
  });
}

/**
 * 글 수정. 서버가 돌려준 글 전체로 상세·목록 캐시를 교체한다(좋아요·댓글 수 등 다른 필드도 서버 값 기준).
 * 404(다른 곳에서 삭제됨)이면 상세를 다시 조회해 "없는 글" 화면으로 넘어가게 한다.
 */
export function useUpdatePost(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => updatePost(postId, input),
    onSuccess: (post) => {
      updatePostInCaches(queryClient, postId, () => post);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
        void queryClient.invalidateQueries({ queryKey: postKeys.list(), refetchType: "none" });
      }
    },
  });
}
