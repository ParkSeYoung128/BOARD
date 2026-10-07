"use client";

import { formatCount } from "@/shared/lib/number";
import { Icon } from "@/shared/ui/Icon";

import { useToggleLike } from "./mutations";
import type { Post } from "./types";

/** 좋아요 토글 버튼. 상태·숫자는 모두 캐시의 글에서 읽고, 누르면 mutation 이 캐시를 갱신한다. */
export function LikeButton({ post, disabled = false }: { post: Post; disabled?: boolean }) {
  const toggle = useToggleLike(post.id);
  return (
    <button
      type="button"
      aria-pressed={post.isLiked}
      disabled={disabled}
      onClick={() => toggle.mutate()}
      className="flex items-center gap-1.5 text-[13px] text-ink-muted"
    >
      <Icon name="heart" filled={post.isLiked} width={24} height={24} className={post.isLiked ? "text-like" : "text-mist-300"} />
      <span>좋아요 {formatCount(post.likeCount)}</span>
    </button>
  );
}
