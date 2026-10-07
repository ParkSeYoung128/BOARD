import { describe, expect, it } from "vitest";

import { formatCount } from "./number";

describe("formatCount", () => {
  it("천 단위 쉼표를 붙인다", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1411)).toBe("1,411");
    expect(formatCount(1796)).toBe("1,796");
    expect(formatCount(1234567)).toBe("1,234,567");
  });
});
