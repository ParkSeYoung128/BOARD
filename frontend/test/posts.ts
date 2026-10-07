import type { Post } from "@/features/posts/types";

export function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    id,
    title: `제목 ${id}`,
    content: `내용 ${id}`,
    likeCount: 294,
    commentCount: 1815,
    isLiked: false,
    author: "dewy_day",
    createdAt: "2026-09-30T09:00:00Z",
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
