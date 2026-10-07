"use client";

import { formatCount } from "@/shared/lib/number";
import { InfiniteSentinel } from "@/shared/ui/InfiniteSentinel";

import { PostCard } from "./PostCard";
import { usePostList } from "./queries";

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-btn border border-line px-4 py-2 text-[14px] text-ink">
      다시 시도
    </button>
  );
}

function PostListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="pt-2">
      <span className="sr-only">게시글을 불러오는 중</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex h-[118px] animate-pulse flex-col justify-center gap-2 border-b border-line px-4">
          <div className="h-4 w-24 rounded bg-section" />
          <div className="h-5 w-3/4 rounded bg-section" />
          <div className="h-4 w-full rounded bg-section" />
          <div className="h-3 w-1/3 rounded bg-section" />
        </div>
      ))}
    </div>
  );
}

/**
 * 게시글 목록(무한 스크롤). 상태를 세 가지로 나눠 판단한다.
 * - 첫 페이지 오류(`!data`): 전체 오류 화면. 데이터가 없을 때만 이 화면을 쓴다.
 * - 다음 페이지 오류(`isFetchNextPageError`): 목록은 유지하고 하단에 다시 시도를 둔다. 센티널은 꺼서 재요청 루프를 막는다.
 * - 재조회 실패(`isRefetchError`): 별도 처리 없이 기존 목록을 그대로 둔다. `isError` 만 보면 멀쩡한 목록이 오류 화면으로 바뀐다.
 */
export function PostList() {
  const { data, status, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } = usePostList();

  if (!data) {
    if (status === "error") {
      return (
        <main className="flex flex-col items-center gap-3 px-4 pt-32 text-center">
          <p className="text-[15px] text-ink-body">게시글을 불러오지 못했습니다.</p>
          <RetryButton onClick={() => void refetch()} />
        </main>
      );
    }
    return (
      <main>
        <PostListSkeleton />
      </main>
    );
  }

  const posts = data.pages.flatMap((page) => page.items);
  if (posts.length === 0) {
    return (
      <main className="flex flex-col items-center gap-1 px-4 pt-32 text-center">
        <p className="text-[15px] text-ink-body">아직 게시글이 없어요.</p>
        <p className="text-[13px] text-ink-muted">첫 글을 작성해 보세요.</p>
      </main>
    );
  }

  // 한 화면은 같은 기준 시각을 쓰도록 목록에서 한 번만 만든다.
  const now = new Date();

  return (
    <main className="pb-[120px]">
      <ul className="pt-2" aria-label={`게시글 ${formatCount(data.pages[0].total)}개`}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} now={now} />
        ))}
      </ul>

      <InfiniteSentinel
        onVisible={() => void fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage || isFetchNextPageError}
      />

      {isFetchingNextPage ? (
        <div role="status" className="py-5 text-center text-[13px] text-ink-muted">
          불러오는 중…
        </div>
      ) : null}
      {isFetchNextPageError && !isFetchingNextPage ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-5">
          <p className="text-[13px] text-ink-muted">더 불러오지 못했습니다.</p>
          <RetryButton onClick={() => void fetchNextPage()} />
        </div>
      ) : null}
      {!hasNextPage ? <p className="py-6 text-center text-[13px] text-ink-muted">마지막 글입니다.</p> : null}
    </main>
  );
}
