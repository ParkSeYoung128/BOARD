"use client";

import { useRef, useState } from "react";

import { countCodePoints, truncateCodePoints } from "@/shared/lib/codepoint";
import { BackButton } from "@/shared/ui/BackButton";
import { Header } from "@/shared/ui/Header";

import type { PostInput } from "./api";

/** 제목 최대 길이(명세, 코드포인트 기준). 내용 상한은 방어용 값으로 자율 구현이다(README 기록). */
export const TITLE_MAX_LENGTH = 20;
export const CONTENT_MAX_LENGTH = 20_000;

type PostFormProps = {
  /** 화면 제목 겸 접근성 이름. 작성은 "글작성", 수정은 "글수정". */
  heading: string;
  submitLabel: string;
  initial?: PostInput;
  /** 요청 중에는 버튼을 막아 중복 제출을 방지한다. */
  pending?: boolean;
  onSubmit: (input: PostInput) => void;
};

/** 제목은 20자까지만 남긴다. 판단·전송 모두 이 값을 쓴다. */
function clampTitle(value: string) {
  return truncateCodePoints(value, TITLE_MAX_LENGTH);
}

/**
 * 작성·수정 공통 폼. 상태는 마운트될 때 `initial` 로 한 번만 채운다.
 * 수정 화면이 서버 값을 다시 받아와도 입력 중인 내용을 덮어쓰지 않도록, 부모는 `key` 로 폼을 만들고 이 값을 갱신하지 않는다.
 *
 * - 제목 20자는 서버와 같은 코드포인트 기준이며 `maxLength` 속성은 쓰지 않는다(UTF-16 단위로 세고 한글 조합을 깨뜨리는 브라우저가 있다).
 * - 한글 조합 중에는 자르지 않는다. 조합이 끝나는 시점에 입력창의 실제 값으로 자른다(브라우저마다 `input`/`compositionend` 순서가 다르다).
 * - 내용은 자르지 않고, 20,000자를 넘으면 안내를 보여 주며 제출을 막는다.
 * - 버튼 활성 상태만 믿지 않고 제출 시점에 한 번 더 검증한다(모바일에서는 조합 중에 버튼을 누를 수 있다).
 */
export function PostForm({ heading, submitLabel, initial, pending = false, onSubmit }: PostFormProps) {
  const [title, setTitle] = useState(() => clampTitle(initial?.title ?? ""));
  const [content, setContent] = useState(initial?.content ?? "");
  const composing = useRef(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const contentTooLong = countCodePoints(content) > CONTENT_MAX_LENGTH;
  // 판단에만 trim 을 쓰고 전송은 원문으로 한다(서버도 앞뒤 공백을 그대로 저장한다).
  const valid = clampTitle(title).trim() !== "" && content.trim() !== "" && !contentTooLong;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const finalTitle = clampTitle(title);
    if (pending || finalTitle.trim() === "" || content.trim() === "" || countCodePoints(content) > CONTENT_MAX_LENGTH) {
      return;
    }
    onSubmit({ title: finalTitle, content });
  }

  return (
    <form onSubmit={submit} className="flex h-dvh flex-col" aria-label={heading}>
      <Header left={<BackButton />} />

      <div className="flex min-h-0 flex-1 flex-col px-4">
        <h2 className="pt-[34px] text-[14px] leading-5 font-bold text-ink">{heading}</h2>

        <input
          type="text"
          aria-label="제목"
          placeholder="제목을 입력해 주세요. (최대 20자)"
          value={title}
          autoComplete="off"
          onChange={(event) => {
            const value = event.target.value;
            setTitle(composing.current ? value : clampTitle(value));
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            setTitle(clampTitle(event.currentTarget.value));
          }}
          // 제목에서 Enter 는 제출이 아니라 내용 칸으로 이동한다(조합 확정 Enter 는 그대로 둔다).
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }
            event.preventDefault();
            if (!event.nativeEvent.isComposing) {
              contentRef.current?.focus();
            }
          }}
          className="mt-[5px] h-[42px] w-full border-b border-line bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-placeholder focus:border-ink"
        />

        <textarea
          ref={contentRef}
          aria-label="내용"
          placeholder={"게시글 내용을 작성해주세요.\n부적합한 내용은 삭제될 수 있으며, 비방/욕설 등의 내용으로 신고가 접수될 경우 서비스 이용이 제한될 수 있습니다."}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="mt-[30px] min-h-0 w-full flex-1 resize-none bg-transparent text-[14px] leading-[18px] text-ink outline-none placeholder:text-ink-placeholder"
        />
        {contentTooLong ? (
          <p role="alert" className="pt-2 text-[12px] text-brand">
            내용은 {CONTENT_MAX_LENGTH.toLocaleString("ko-KR")}자까지 입력할 수 있어요.
          </p>
        ) : null}
      </div>

      <div className="px-4 pt-3 pb-4">
        <button
          type="submit"
          disabled={!valid || pending}
          aria-busy={pending}
          className="h-14 w-full rounded-btn bg-ink text-[16px] font-bold text-white disabled:bg-mist-200"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
