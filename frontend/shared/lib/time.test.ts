import { describe, expect, it } from "vitest";

import { formatCommentTime, formatDate, formatRelative } from "./time";

const NOW = new Date("2026-09-30T12:00:00Z");

/** NOW 에서 (일, 시, 분, 초) 만큼 이전 시각의 ISO 문자열. */
function ago({ d = 0, h = 0, m = 0, s = 0 }: { d?: number; h?: number; m?: number; s?: number }) {
  const ms = (((d * 24 + h) * 60 + m) * 60 + s) * 1000;
  return new Date(NOW.getTime() - ms).toISOString();
}

describe("formatRelative", () => {
  it.each([
    [{ s: 0 }, "방금 전"],
    [{ s: 59 }, "방금 전"],
    [{ s: 60 }, "1분 전"],
    [{ m: 59, s: 59 }, "59분 전"],
    [{ h: 1 }, "1시간 전"],
    [{ h: 23, m: 59, s: 59 }, "23시간 전"],
    [{ h: 24 }, "1일 전"],
    [{ d: 6, h: 23 }, "6일 전"],
    [{ d: 7 }, "1주 전"],
    [{ d: 14 }, "2주 전"],
    [{ d: 29 }, "4주 전"],
    [{ d: 30 }, "1개월 전"],
    [{ d: 364 }, "12개월 전"],
    [{ d: 365 }, "1년 전"],
    [{ d: 800 }, "2년 전"],
  ])("%j 이전은 %s", (offset, expected) => {
    expect(formatRelative(ago(offset), NOW)).toBe(expected);
  });

  it("미래 시각(시계 오차)은 방금 전으로 본다", () => {
    expect(formatRelative(new Date(NOW.getTime() + 5_000).toISOString(), NOW)).toBe("방금 전");
  });
});

describe("formatDate", () => {
  it("yy.MM.dd 로 표기한다", () => {
    expect(formatDate("2026-08-30T13:55:54Z")).toBe("26.08.30");
  });

  it("Asia/Seoul 기준으로 날짜가 넘어간다 (UTC 15:00 = 서울 다음 날 00:00)", () => {
    expect(formatDate("2026-08-30T14:59:59Z")).toBe("26.08.30");
    expect(formatDate("2026-08-30T15:00:00Z")).toBe("26.08.31");
  });
});

describe("formatCommentTime", () => {
  it("30일 미만은 상대 시간이다", () => {
    expect(formatCommentTime(ago({ d: 29 }), NOW)).toBe("4주 전");
    expect(formatCommentTime(ago({ m: 5 }), NOW)).toBe("5분 전");
  });

  it("30일부터는 날짜(yy.MM.dd)다", () => {
    expect(formatCommentTime(ago({ d: 30 }), NOW)).toBe("26.08.31");
  });
});
