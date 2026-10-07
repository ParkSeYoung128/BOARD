import { describe, expect, it } from "vitest";

import { avatarIndex, avatarSrc } from "./avatar";

describe("avatarIndex", () => {
  it("같은 작성자는 항상 같은 아바타다", () => {
    expect(avatarIndex("demo_user")).toBe(avatarIndex("demo_user"));
  });

  it("1~3 범위 안이다", () => {
    for (const author of ["a", "demo_user", "glow_note", "soft_toner", "한글작성자", "😀"]) {
      const index = avatarIndex(author);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(3);
    }
  });

  it("경로로 변환한다", () => {
    expect(avatarSrc("demo_user")).toMatch(/^\/avatar-[123]\.png$/);
  });
});
