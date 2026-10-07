"use client";

import { useRouter } from "next/navigation";

import { useToast } from "@/shared/store/toast";

import { useCreatePost } from "./mutations";
import { PostForm } from "./PostForm";

/**
 * 글 작성 화면. 성공하면 토스트를 띄우고 목록으로 `replace` 이동한다.
 * `push` 가 아니라 `replace` 인 이유: 뒤로가기로 이미 등록한 글이 채워진 폼에 돌아와 같은 글을 또 올리는 일을 막기 위해서다.
 * 실패하면 입력은 그대로 둔다.
 */
export function PostWrite() {
  const router = useRouter();
  const create = useCreatePost();

  return (
    <PostForm
      heading="글작성"
      submitLabel="작성 완료"
      pending={create.isPending}
      onSubmit={(input) =>
        create.mutate(input, {
          onSuccess: () => {
            useToast.getState().show("게시글이 등록되었습니다.");
            router.replace("/");
          },
          onError: () => useToast.getState().show("게시글을 등록하지 못했습니다."),
        })
      }
    />
  );
}
