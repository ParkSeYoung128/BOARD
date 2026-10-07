"use client";

import { CommentSection } from "@/features/comments/CommentSection";
import { ApiError } from "@/shared/api/client";
import { getCurrentUserId } from "@/shared/lib/currentUser";
import { formatCount } from "@/shared/lib/number";
import { formatDate } from "@/shared/lib/time";
import { Avatar } from "@/shared/ui/Avatar";
import { BackButton } from "@/shared/ui/BackButton";
import { Header } from "@/shared/ui/Header";

import { LikeButton } from "./LikeButton";
import { PostMenu } from "./PostMenu";
import { PostNotFound } from "./PostNotFound";
import { usePost } from "./queries";

function DetailSkeleton() {
  return (
    <>
      <Header left={<BackButton />} />
      <div role="status" aria-busy="true" className="animate-pulse px-4 pt-8">
        <span className="sr-only">게시글을 불러오는 중</span>
        <div aria-hidden="true" className="space-y-6">
          <div className="h-6 w-3/4 rounded bg-section" />
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-section" />
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-section" />
              <div className="h-3 w-16 rounded bg-section" />
            </div>
          </div>
          <div className="h-24 rounded bg-section" />
        </div>
      </div>
    </>
  );
}

/**
 * 게시글 상세. 상태 판단은 목록과 같은 원칙이다.
 * - 404 는 오류가 아니라 "없는 글" 화면이다(캐시가 있어도 마찬가지).
 * - 그 밖의 오류는 데이터가 없을 때만 전체 로딩·오류 화면을 쓴다(이미 보이는 글은 재조회가 실패해도 그대로 둔다).
 */
export function PostDetail({ postId }: { postId: number }) {
  const { data: post, status, error, refetch, isPlaceholderData } = usePost(postId);

  // 404 는 캐시가 있어도 먼저 처리한다. 다른 곳에서 글이 삭제된 뒤 재조회하면 에러와 기존 데이터가 함께 오는데,
  // 이때 삭제된 본문과 좋아요 버튼을 계속 보여 주면 안 된다. 그 밖의 재조회 오류는 기존 본문을 유지한다.
  if (status === "error" && error instanceof ApiError && error.status === 404) {
    return <PostNotFound />;
  }

  if (!post) {
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
    return <DetailSkeleton />;
  }

  const isMine = post.author === getCurrentUserId();

  return (
    <>
      <Header left={<BackButton />} right={isMine ? <PostMenu postId={post.id} /> : null} />
      <main className="pb-[88px]">
        <article className="px-4 pt-8 pb-3">
          <h2 className="text-[18px] leading-[26px] font-bold break-words text-ink">{post.title}</h2>
          <div className="mt-5 flex items-center gap-3">
            <Avatar author={post.author} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-5 font-bold text-ink">{post.author}</p>
              <p className="text-[12px] leading-4 text-ink-muted">
                <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
              </p>
            </div>
          </div>
          <p className="mt-5 text-[14px] leading-[18px] break-words whitespace-pre-wrap text-ink">{post.content}</p>
          <div className="mt-10">
            <LikeButton post={post} disabled={isPlaceholderData} />
          </div>
        </article>

        <div aria-hidden="true" className="h-2 bg-section" />

        <section aria-labelledby="comments-heading">
          <h3 id="comments-heading" className="flex h-12 items-center border-b border-line px-4 pt-1 text-[16px] font-bold text-ink">
            댓글 ({formatCount(post.commentCount)})
          </h3>
          <CommentSection postId={post.id} />
        </section>
      </main>
    </>
  );
}
