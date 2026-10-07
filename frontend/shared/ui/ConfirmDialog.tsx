"use client";

import * as Dialog from "@radix-ui/react-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** 요청 중에는 버튼을 막아 중복 제출을 방지한다. */
  pending?: boolean;
};

/** 삭제 확인 팝업(시안: 폭 326px, 버튼 2개). 포커스 트랩·ESC·스크린리더 처리는 Radix Dialog 가 맡는다. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "예",
  cancelLabel = "취소",
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[326px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-modal bg-white px-[26px] pt-[54px] pb-10 outline-none">
          <Dialog.Title className="text-center text-[16px] font-bold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-4 text-center text-[14px] leading-[23px] whitespace-pre-line text-ink-placeholder">
            {description}
          </Dialog.Description>
          <div className="mt-8 flex gap-[15px]">
            <Dialog.Close
              className="h-14 flex-1 rounded-btn bg-line text-[16px] font-bold text-cancel-text"
              disabled={pending}
            >
              {cancelLabel}
            </Dialog.Close>
            <button
              type="button"
              className="h-14 flex-1 rounded-btn bg-ink text-[16px] font-bold text-white disabled:opacity-60"
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
