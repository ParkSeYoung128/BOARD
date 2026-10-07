import { describe, expect, it } from "vitest";

import { countCodePoints, truncateCodePoints } from "./codepoint";

describe("countCodePoints", () => {
  it("한글·영문은 글자마다 1로 센다", () => {
    expect(countCodePoints("BOARD")).toBe(5);
    expect(countCodePoints("abc")).toBe(3);
  });

  it("이모지는 UTF-16 길이(2)가 아니라 1로 센다", () => {
    expect("😀".length).toBe(2);
    expect(countCodePoints("😀")).toBe(1);
    expect(countCodePoints("a😀b")).toBe(3);
  });

  it("결합 이모지는 구성 코드포인트 수로 센다(서버와 같은 기준, grapheme 기준은 쓰지 않는다)", () => {
    expect(countCodePoints("👨‍👩‍👧")).toBe(5);
  });

  it("빈 문자열은 0", () => {
    expect(countCodePoints("")).toBe(0);
  });
});

describe("truncateCodePoints", () => {
  it("max 자까지만 남긴다", () => {
    expect(truncateCodePoints("abcdef", 3)).toBe("abc");
    expect(truncateCodePoints("abc", 3)).toBe("abc");
    expect(truncateCodePoints("abc", 10)).toBe("abc");
  });

  it("이모지를 반으로 쪼개지 않는다", () => {
    expect(truncateCodePoints("😀😀😀", 2)).toBe("😀😀");
    expect(truncateCodePoints("a😀b", 2)).toBe("a😀");
  });

  it("max 가 0 이하면 빈 문자열", () => {
    expect(truncateCodePoints("abc", 0)).toBe("");
    expect(truncateCodePoints("abc", -1)).toBe("");
  });
});
