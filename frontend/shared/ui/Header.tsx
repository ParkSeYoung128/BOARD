import type { ReactNode } from "react";

type HeaderProps = {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /**
   * `bar`: 상세·작성 화면의 상단 바. 뒤로가기(왼쪽)·가운데 제목 14px·메뉴(오른쪽) 슬롯.
   * `page`: 목록 화면의 헤더. 제목을 왼쪽 정렬 20px bold 로 두고 아래에 1px 구분선을 긋는다.
   */
  variant?: "bar" | "page";
};

/** 상단 바. 높이는 시안의 48px(`page` 는 하단 구분선까지 포함해 48px). */
export function Header({ title, left, right, variant = "bar" }: HeaderProps) {
  if (variant === "page") {
    return (
      <header className="flex h-12 items-center border-b border-line px-4">
        {title ? <h1 className="min-w-0 truncate text-[20px] font-bold text-ink">{title}</h1> : null}
        {right ? <div className="ml-auto flex items-center">{right}</div> : null}
      </header>
    );
  }
  return (
    <header className="relative flex h-12 items-center justify-between px-4">
      <div className="flex min-w-6 items-center">{left}</div>
      {title ? <h1 className="absolute inset-x-12 truncate text-center text-[14px] font-bold text-ink">{title}</h1> : null}
      <div className="flex min-w-6 items-center justify-end">{right}</div>
    </header>
  );
}
