import { formatCommentTime } from "@/shared/lib/time";
import { Avatar } from "@/shared/ui/Avatar";

import type { Comment } from "./types";

type CommentItemProps = {
  comment: Comment;
  /** 본인 댓글이면 삭제 버튼을 보여 준다. */
  mine: boolean;
  now: Date;
  onDelete: (commentId: number) => void;
};

/**
 * 댓글 한 개. 시안대로 작성자 이름 오른쪽에 시각을 두고, 본문 아래에 "삭제"(본인 댓글만)를 둔다.
 * 이름이 길면 이름만 말줄임하고 시각은 항상 보이게 한다.
 */
export function CommentItem({ comment, mine, now, onDelete }: CommentItemProps) {
  return (
    <li className="border-b border-line px-4 py-4">
      <div className="flex items-start gap-2">
        <Avatar author={comment.author} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex h-8 min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] leading-5 font-bold text-ink">{comment.author}</span>
            <time dateTime={comment.createdAt} className="shrink-0 text-[12px] leading-4 text-ink-muted">
              {formatCommentTime(comment.createdAt, now)}
            </time>
          </p>
          <p className="text-[14px] leading-[18px] break-words whitespace-pre-wrap text-ink">{comment.content}</p>
          {mine ? (
            <button type="button" onClick={() => onDelete(comment.id)} className="mt-2 py-1 text-[12px] text-ink-muted">
              삭제
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
