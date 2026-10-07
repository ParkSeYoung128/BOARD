"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ApiError } from "@/shared/api/client";
import { getCurrentUserId } from "@/shared/lib/currentUser";
import { useToast } from "@/shared/store/toast";
import { BackButton } from "@/shared/ui/BackButton";
import { Header } from "@/shared/ui/Header";

import { useUpdatePost } from "./mutations";
import { PostForm } from "./PostForm";
import { PostNotFound } from "./PostNotFound";
import { usePost } from "./queries";

function EditSkeleton() {
  return (
    <>
      <Header left={<BackButton />} />
      <div role="status" aria-busy="true" className="animate-pulse px-4 pt-[34px]">
        <span className="sr-only">게시글을 불러오는 중</span>
        <div aria-hidden="true" className="space-y-6">
          <div className="h-5 w-16 rounded bg-section" />
          <div className="h-5 w-3/4 rounded bg-section" />
          <div className="h-24 rounded bg-section" />
        </div>
      </div>
    </>
  );
}

/**
 * 글 수정 화면. 서버가 확정한 글(placeholder 가 아닌 응답)이 도착한 뒤에만 폼을 그린다.
 * 목록 캐시에서 온 값으로 먼저 채우면 오래된 값이 보이고, 뒤늦게 도착한 서버 값이 입력을 덮어쓸 수 있다.
 * 폼은 `key` 로 한 번 만들고 초기값을 다시 넣지 않으므로, 이후 백그라운드 재조회가 일어나도 입력 중인 내용은 유지된다.
 */
export function PostEdit({ postId, fromDetail = false }: { postId: number; fromDetail?: boolean }) {
  const router = useRouter();
  const { data: post, status, error, refetch, isPlaceholderData } = usePost(postId);
  const update = useUpdatePost(postId);

  const notMine = post !== undefined && !isPlaceholderData && post.author !== getCurrentUserId();
  useEffect(() => {
    // 본인 글이 아니면 폼 대신 상세로 돌려보낸다(서버도 거부하지만 폼을 보여 줄 이유가 없다).
    if (notMine) {
      router.replace(`/posts/${postId}`);
    }
  }, [notMine, postId, router]);

  if (status === "error" && error instanceof ApiError && error.status === 404) {
    return <PostNotFound />;
  }

  if (!post || isPlaceholderData) {
    if (status === "error") {
      return (
        <>
          <Header left={<BackButton />} />
          <main className="flex flex-col items-center gap-3 px-4 pt-32 text-center">
            <p className="text-[15px] text-ink-body">게시글을 불러오지 못했습니다.</p>
            <button type="button" onClick={() => void refetch()} className="rounded-btn border border-line px-4 py-2 text-[14px] text-ink">
              다시 시도
            </button>
          </main>
        </>
      );
    }
    return <EditSkeleton />;
  }

  if (notMine) {
    return <EditSkeleton />;
  }

  return (
    <PostForm
      key={post.id}
      heading="글수정"
      submitLabel="수정 완료"
      initial={{ title: post.title, content: post.content }}
      pending={update.isPending}
      onSubmit={(input) =>
        update.mutate(input, {
          onSuccess: () => {
            useToast.getState().show("게시글이 수정되었습니다.");
            // 상세의 "수정하기"로 들어왔을 때만 기록을 되돌려 상세가 기록에 두 번 쌓이지 않게 한다.
            // 그 밖에는(주소로 직접·외부 사이트에서 들어옴 등) 직전 기록이 이 글의 상세라는 보장이 없으므로 항상 상세로 replace 한다.
            if (fromDetail) {
              router.back();
            } else {
              router.replace(`/posts/${postId}`);
            }
          },
          onError: (failure) => {
            if (failure instanceof ApiError && failure.status === 403) {
              useToast.getState().show("수정 권한이 없습니다.");
              router.replace(`/posts/${postId}`);
            } else if (!(failure instanceof ApiError && failure.status === 404)) {
              // 404 는 상세 재조회로 "없는 글" 화면이 대신 보여 준다.
              useToast.getState().show("게시글을 수정하지 못했습니다.");
            }
          },
        })
      }
    />
  );
}
