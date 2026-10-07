import { apiFetch } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";

import type { Post } from "./types";

type FetchPostsParams = {
  /** 이전 응답의 `nextCursor`. 불투명 값이므로 해석하지 않고 그대로 넘긴다. */
  cursor?: string | null;
  /** 생략하면 서버 기본값(20). 수동 확인·E2E 에서 페이지 경계를 쉽게 만들려고 열어 둔다. */
  limit?: number;
  signal?: AbortSignal;
};

export function fetchPosts({ cursor, limit, signal }: FetchPostsParams = {}): Promise<Page<Post>> {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  const query = params.toString();
  return apiFetch<Page<Post>>(`/posts${query ? `?${query}` : ""}`, { signal });
}

export function fetchPost(id: number, signal?: AbortSignal): Promise<Post> {
  return apiFetch<Post>(`/posts/${id}`, { signal });
}

export type LikeResult = { isLiked: boolean; likeCount: number };

/** 좋아요 토글. 서버가 확정한 `{ isLiked, likeCount }` 를 돌려준다. */
export function toggleLike(id: number): Promise<LikeResult> {
  return apiFetch<LikeResult>(`/posts/${id}/likes/toggle`, { method: "POST" });
}

export function deletePost(id: number): Promise<void> {
  return apiFetch<void>(`/posts/${id}`, { method: "DELETE" });
}


/** 작성·수정 본문. 제약(제목 20자·제목/내용 필수)은 서버가 최종 검증하고, 화면은 같은 기준으로 미리 막는다. */
export type PostInput = { title: string; content: string };

export function createPost(input: PostInput): Promise<Post> {
  return apiFetch<Post>("/posts", { method: "POST", body: input });
}

/** 수정은 제목과 내용을 모두 보낸다(명세: 작성 화면과 동일한 폼). */
export function updatePost(id: number, input: PostInput): Promise<Post> {
  return apiFetch<Post>(`/posts/${id}`, { method: "PATCH", body: input });
}
