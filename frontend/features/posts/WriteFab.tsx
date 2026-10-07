import Link from "next/link";

import { Icon } from "@/shared/ui/Icon";

/**
 * 작성 버튼(FAB). 375px 셸 안쪽 오른쪽 아래에 둔다.
 * `fixed right-4` 로 두면 데스크톱에서 셸 밖 화면 끝에 붙으므로, 토스트처럼 셸 폭의 고정 래퍼 안에서 오른쪽 정렬한다.
 */
export function WriteFab() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex w-full max-w-[375px] justify-end px-4"
      style={{ bottom: "calc(49px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Link
        href="/write"
        aria-label="글쓰기"
        className="pointer-events-auto flex size-[50px] items-center justify-center rounded-full bg-brand text-white shadow-md"
      >
        <Icon name="pencil" width={22} height={22} />
      </Link>
    </div>
  );
}
