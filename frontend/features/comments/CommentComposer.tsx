"use client";

import { useState } from "react";

import { countCodePoints } from "@/shared/lib/codepoint";
import { Icon } from "@/shared/ui/Icon";

import { useCreateComment } from "./mutations";

/** 서버 상한(명세 외 방어용 값, 자율 구현). 코드포인트 기준이라 서버와 같은 방식으로 센다. */
export const COMMENT_MAX_LENGTH = 5_000;

/**
 * 하단 고정 댓글 입력창. 375px 셸 폭의 고정 래퍼 안에 둔다(`fixed` 만 쓰면 데스크톱에서 셸 밖 화면 끝에 붙는다).
 * 내용이 있을 때만 전송 아이콘을 보여 주고, 등록 중에는 막아 중복 제출을 방지한다. 실패하면 입력값을 그대로 둔다.
 */
export function CommentComposer({ postId }: { postId: number }) {
  const [value, setValue] = useState("");
  const create = useCreateComment(postId);

  const content = value.trim();
  const canSend = content.length > 0 && countCodePoints(content) <= COMMENT_MAX_LENGTH;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend || create.isPending) {
      return;
    }
    create.mutate(content, { onSuccess: () => setValue("") });
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[375px]"
    >
      <form
        onSubmit={submit}
        className="pointer-events-auto border-t border-line bg-white px-4 pt-2"
        style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex h-10 items-center rounded-pill border border-line pr-1 pl-4">
          <input
            type="text"
            aria-label="댓글 입력"
            placeholder="댓글을 입력하세요."
            value={value}
            onChange={(event) => setValue(event.target.value)}
            // 한글 조합 중 Enter 는 글자 확정이지 제출이 아니다(일부 브라우저가 조합 중 Enter 로 제출한다).
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.nativeEvent.isComposing) {
                event.preventDefault();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-placeholder"
          />
          {canSend ? (
            <button
              type="submit"
              aria-label="댓글 등록"
              disabled={create.isPending}
              className="flex size-8 shrink-0 items-center justify-center text-ink disabled:opacity-40"
            >
              <Icon name="send" width={22} height={22} />
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
