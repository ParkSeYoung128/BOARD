"use client";

import { useState } from "react";

import { getCurrentUserId } from "@/shared/lib/currentUser";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Icon } from "@/shared/ui/Icon";
import { InfiniteSentinel } from "@/shared/ui/InfiniteSentinel";

import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import { useDeleteComment } from "./mutations";
import { FIRST_PAGE_SIZE, useComments } from "./queries";

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-btn border border-line px-4 py-2 text-[14px] text-ink">
      다시 시도
    </button>
  );
}

/**
 * 댓글 목록 + 작성 + 삭제. 상태 판단은 글 목록과 같은 원칙이다.
 * - 첫 페이지 오류(`!data`): 댓글 영역만 오류와 다시 시도를 보여 준다(글 본문은 그대로).
 * - 다음 페이지 오류(`isFetchNextPageError`): 불러온 댓글은 유지하고 하단에 다시 시도를 둔다.
 * - 처음에는 2개만 보이고 "댓글 더보기"를 누르면 20개씩 이어서 불러온다. 이후에는 스크롤로 자동 로딩한다.
 * - "펼쳐졌는가"는 따로 기억하지 않고 캐시의 페이지 수에서 계산한다. 컴포넌트 상태로 두면 뒤로·앞으로 이동으로 다시 열 때
 *   캐시에는 여러 페이지가 남아 있는데 상태만 초기화되어, 이미 길게 보이는 목록에 "댓글 더보기"가 다시 나타난다.
 */
export function CommentSection({ postId }: { postId: number }) {
  const { data, status, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } = useComments(postId);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const remove = useDeleteComment(postId);

  function confirmDelete() {
    if (deleteTarget === null) {
      return;
    }
    remove.mutate(deleteTarget, { onSettled: () => setDeleteTarget(null) });
  }

  let body: React.ReactNode;
  if (!data) {
    body =
      status === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-[14px] text-ink-body">댓글을 불러오지 못했습니다.</p>
          <RetryButton onClick={() => void refetch()} />
        </div>
      ) : (
        <div role="status" aria-busy="true" className="animate-pulse px-4 py-4">
          <span className="sr-only">댓글을 불러오는 중</span>
          <div aria-hidden="true" className="space-y-4">
            {[0, 1].map((index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-section" />
                <div className="h-4 w-1/2 rounded bg-section" />
              </div>
            ))}
          </div>
        </div>
      );
  } else {
    const comments = data.pages.flatMap((page) => page.items);
    // 두 번째 페이지를 불러오는 중이거나 실패한 경우도 펼친 상태다. 실패했을 때 "더보기"와 "다시 시도"가 함께 보이지 않게 한다.
    const expanded = data.pages.length > 1 || isFetchingNextPage || isFetchNextPageError;
    const total = data.pages[0].total;
    const currentUserId = getCurrentUserId();
    // 한 화면은 같은 기준 시각을 쓰도록 한 번만 만든다.
    const now = new Date();

    body =
      comments.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
          <p className="text-[14px] text-ink-body">아직 댓글이 없어요.</p>
          <p className="text-[13px] text-ink-muted">첫 댓글을 남겨 보세요.</p>
        </div>
      ) : (
        <>
          <ul>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                mine={comment.author === currentUserId}
                now={now}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>

          {!expanded && total > FIRST_PAGE_SIZE ? (
            <div className="px-4 py-4">
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                className="flex h-[42px] w-full items-center justify-center gap-1 rounded-more border border-line text-[14px] text-cancel-text"
              >
                댓글 더보기
                <Icon name="chevron-down" width={16} height={16} />
              </button>
            </div>
          ) : null}

          {expanded ? (
            <InfiniteSentinel
              onVisible={() => void fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage || isFetchNextPageError}
            />
          ) : null}
          {isFetchingNextPage ? (
            <div role="status" className="py-5 text-center text-[13px] text-ink-muted">
              불러오는 중…
            </div>
          ) : null}
          {isFetchNextPageError && !isFetchingNextPage ? (
            <div role="alert" className="flex flex-col items-center gap-2 py-5">
              <p className="text-[13px] text-ink-muted">댓글을 더 불러오지 못했습니다.</p>
              <RetryButton onClick={() => void fetchNextPage()} />
            </div>
          ) : null}
        </>
      );
  }

  return (
    <>
      {body}
      <CommentComposer postId={postId} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="삭제하기"
        description={"삭제한 댓글은 복구할 수 없습니다.\n정말 삭제 하시겠습니까?"}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />
    </>
  );
}
