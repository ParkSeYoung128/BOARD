"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 화면에는 보이지 않지만 스크린리더가 시트의 용도를 알 수 있게 한다. */
  title: string;
  children: ReactNode;
};

/**
 * 하단 시트(시안의 ⋯ 메뉴). Radix Dialog 로 만들어 접근성은 위임하고 모양은 직접 만든다.
 * 스와이프로 닫기는 지원하지 않는다(시안에 제스처 요구가 없다).
 */
export function BottomSheet({ open, onOpenChange, title, children }: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed bottom-0 left-1/2 z-50 w-full max-w-[375px] -translate-x-1/2 rounded-t-modal bg-white outline-none">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {children}
          <Dialog.Close className="h-14 w-full bg-ink text-[16px] font-bold text-white">취소</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 시트의 항목 한 줄(아이콘 + 글자, 중앙 정렬, 아래 구분선). */
export function BottomSheetItem({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-14 w-full items-center justify-center gap-2 border-b border-line text-[16px] text-ink"
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
