import { apiFetch } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";

import type { Comment } from "./types";

type FetchCommentsParams = {
  postId: number;
  /** 이전 응답의 `nextCursor`. 불투명 값이므로 해석하지 않고 그대로 넘긴다. */
  cursor?: string | null;
  limit: number;
  signal?: AbortSignal;
};

export function fetchComments({ postId, cursor, limit, signal }: FetchCommentsParams): Promise<Page<Comment>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return apiFetch<Page<Comment>>(`/posts/${postId}/comments?${params.toString()}`, { signal });
}

export function createComment(postId: number, content: string): Promise<Comment> {
  return apiFetch<Comment>(`/posts/${postId}/comments`, { method: "POST", body: { content } });
}

export function deleteComment(commentId: number): Promise<void> {
  return apiFetch<void>(`/comments/${commentId}`, { method: "DELETE" });
}
