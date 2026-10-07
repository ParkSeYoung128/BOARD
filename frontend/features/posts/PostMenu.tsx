"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/shared/store/toast";
import { BottomSheet, BottomSheetItem } from "@/shared/ui/BottomSheet";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Icon } from "@/shared/ui/Icon";

import { useDeletePost } from "./mutations";

/** 본인 글의 ⋯ 메뉴: 바텀시트(수정하기·삭제하기)와 삭제 확인 팝업. */
export function PostMenu({ postId }: { postId: number }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeletePost(postId);

  function confirmDelete() {
    remove.mutate(undefined, {
      onSuccess: () => router.replace("/"),
      onError: () => {
        setConfirmOpen(false);
        useToast.getState().show("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      },
    });
  }

  return (
    <>
      <button type="button" aria-label="메뉴" className="-mr-1 flex size-8 items-center justify-center text-ink" onClick={() => setSheetOpen(true)}>
        <Icon name="more" />
      </button>

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="게시글 메뉴">
        <BottomSheetItem
          icon={<Icon name="pencil" width={20} height={20} />}
          onClick={() => {
            setSheetOpen(false);
            // 수정 완료 후 되돌아갈 곳이 이 상세 화면임을 주소로 알린다(PostEdit 이 이 표시가 있을 때만 router.back() 을 쓴다).
            router.push(`/posts/${postId}/edit?from=detail`);
          }}
        >
          수정하기
        </BottomSheetItem>
        <BottomSheetItem
          icon={<Icon name="trash" width={20} height={20} />}
          onClick={() => {
            setSheetOpen(false);
            setConfirmOpen(true);
          }}
        >
          삭제하기
        </BottomSheetItem>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="삭제하기"
        description={"삭제한 글은 복구할 수 없습니다.\n정말 삭제 하시겠습니까?"}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />
    </>
  );
}
