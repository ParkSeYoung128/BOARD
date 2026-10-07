import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Header } from "./Header";

describe("Header", () => {
  it("page 변형은 제목을 왼쪽 정렬 20px bold 로 그리고 하단 구분선을 둔다", () => {
    render(<Header variant="page" title="BOARD" />);
    const title = screen.getByRole("heading", { name: "BOARD" });
    expect(title).toHaveClass("text-[20px]", "font-bold");
    expect(title).not.toHaveClass("text-center");
    expect(screen.getByRole("banner")).toHaveClass("border-b", "border-line");
  });

  it("기본(bar) 변형은 제목을 가운데 14px 로 그리고 구분선이 없다", () => {
    render(<Header title="글작성" />);
    const title = screen.getByRole("heading", { name: "글작성" });
    expect(title).toHaveClass("text-center", "text-[14px]");
    expect(screen.getByRole("banner")).not.toHaveClass("border-b");
  });
});
