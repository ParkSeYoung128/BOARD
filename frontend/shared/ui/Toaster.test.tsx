import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/shared/store/toast";

import { Toaster } from "./Toaster";

describe("Toaster", () => {
  afterEach(() => {
    act(() => useToast.getState().hide());
    vi.useRealTimers();
  });

  it("스토어에 메시지가 생기면 보이고, 시간이 지나면 사라진다", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    expect(screen.queryByText("게시글이 등록되었습니다.")).not.toBeInTheDocument();

    act(() => useToast.getState().show("게시글이 등록되었습니다.", 1_000));
    expect(screen.getByText("게시글이 등록되었습니다.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByText("게시글이 등록되었습니다.")).not.toBeInTheDocument();
  });
});
