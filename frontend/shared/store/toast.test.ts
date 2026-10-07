import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "./toast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToast.getState().hide();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("show 하면 메시지가 생기고 지정한 시간 뒤에 사라진다", () => {
    useToast.getState().show("게시글이 등록되었습니다.", 1_000);
    expect(useToast.getState().message).toBe("게시글이 등록되었습니다.");

    vi.advanceTimersByTime(999);
    expect(useToast.getState().message).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(useToast.getState().message).toBeNull();
  });

  it("연달아 호출하면 마지막 메시지가 남고 타이머가 다시 시작된다", () => {
    useToast.getState().show("첫 번째", 1_000);
    vi.advanceTimersByTime(800);
    useToast.getState().show("두 번째", 1_000);

    vi.advanceTimersByTime(800);
    expect(useToast.getState().message).toBe("두 번째");
    vi.advanceTimersByTime(200);
    expect(useToast.getState().message).toBeNull();
  });

  it("hide 는 즉시 닫는다", () => {
    useToast.getState().show("메시지");
    useToast.getState().hide();
    expect(useToast.getState().message).toBeNull();
  });
});
