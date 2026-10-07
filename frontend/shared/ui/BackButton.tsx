"use client";

import { useRouter } from "next/navigation";

import { Icon } from "./Icon";

/**
 * 뒤로가기. 앱 안에서 이동해 왔으면 브라우저 기록으로 돌아가고,
 * 주소로 바로 들어와 돌아갈 기록이 없으면 fallbackHref 로 이동한다.
 */
export function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="뒤로가기"
      className="-ml-1 flex size-8 items-center justify-center text-ink"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      <Icon name="back" />
    </button>
  );
}
