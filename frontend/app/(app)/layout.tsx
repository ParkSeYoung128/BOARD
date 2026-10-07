import { Toaster } from "@/shared/ui/Toaster";

/**
 * 모바일 웹(375px) 셸. dev-user 화면은 이 그룹 밖에 있어 영향을 받지 않는다.
 * 토스트는 화면 이동 후에도 보이도록 이 레이아웃에 둔다(레이아웃은 이동해도 다시 마운트되지 않는다).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[375px] bg-white text-ink">
      {children}
      <Toaster />
    </div>
  );
}
