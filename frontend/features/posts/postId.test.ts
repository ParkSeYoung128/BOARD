import { describe, expect, it } from "vitest";

import { parsePostId } from "./postId";

describe("parsePostId", () => {
  it("양의 정수 문자열은 숫자로 바꾼다", () => {
    expect(parsePostId("7")).toBe(7);
    expect(parsePostId("39")).toBe(39);
  });

  it("숫자가 아니거나 0·음수·소수·공백이 섞이면 null", () => {
    for (const raw of ["abc", "0", "-1", "1.5", "1e3", " 1", "1 ", "", "12a"]) {
      expect(parsePostId(raw)).toBeNull();
    }
  });

  it("안전한 정수 범위를 넘으면 null", () => {
    expect(parsePostId("99999999999999999999")).toBeNull();
  });
});
