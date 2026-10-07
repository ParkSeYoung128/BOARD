import Link from "next/link";

import { formatCount } from "@/shared/lib/number";
import { formatRelative } from "@/shared/lib/time";
import { Avatar } from "@/shared/ui/Avatar";
import { Icon } from "@/shared/ui/Icon";

import type { Post } from "./types";

/**
 * 목록의 카드 한 장. 높이 118px(하단 구분선 포함). 카드 전체가 상세로 가는 링크다.
 * `now` 는 목록에서 한 번 만들어 모든 카드에 넘긴다(한 화면은 같은 기준 시각을 쓰고, 테스트에서 시각을 고정하기 쉽다).
 */
export function PostCard({ post, now }: { post: Post; now: Date }) {
  return (
    <li>
      <Link href={`/posts/${post.id}`} className="flex h-[118px] flex-col justify-center gap-1.5 border-b border-line px-4">
        <span className="flex items-center gap-1.5">
          <Avatar author={post.author} size={16} />
          <span className="truncate text-[13px] text-ink-sub">{post.author}</span>
        </span>
        <span className="truncate text-[16px] font-bold leading-6 text-ink">{post.title}</span>
        <span className="truncate text-[14px] leading-5 text-ink-placeholder">{post.content}</span>
        <span className="flex items-center justify-between text-[12px] text-ink-muted">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Icon name="comment" width={16} height={16} className="text-mist-300" />
              <span>
                <span className="sr-only">댓글 </span>
                {formatCount(post.commentCount)}
                <span className="sr-only">개</span>
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Icon name="heart" width={16} height={16} className="text-mist-300" />
              <span>
                <span className="sr-only">좋아요 </span>
                {formatCount(post.likeCount)}
                <span className="sr-only">개</span>
              </span>
            </span>
          </span>
          <time dateTime={post.createdAt}>{formatRelative(post.createdAt, now)}</time>
        </span>
      </Link>
    </li>
  );
}
