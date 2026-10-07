import Link from "next/link";

import { BackButton } from "@/shared/ui/BackButton";
import { Header } from "@/shared/ui/Header";

/** 없거나 삭제된 글(또는 잘못된 주소). 안내 문구와 목록으로 가는 버튼을 보여 준다. */
export function PostNotFound() {
  return (
    <>
      <Header left={<BackButton />} />
      <main className="flex flex-col items-center gap-4 px-4 pt-32 text-center">
        <p className="text-[15px] text-ink-body">삭제되었거나 존재하지 않는 글입니다.</p>
        <Link href="/" className="rounded-btn bg-ink px-5 py-3 text-[14px] font-bold text-white">
          목록으로
        </Link>
      </main>
    </>
  );
}
