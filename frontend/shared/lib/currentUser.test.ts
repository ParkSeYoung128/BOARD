import { describe, expect, it } from "vitest";

import { DEFAULT_USER_ID, getCurrentUserId } from "./currentUser";

describe("getCurrentUserId", () => {
  it("쿠키가 없으면 기본 사용자", () => {
    expect(getCurrentUserId("")).toBe(DEFAULT_USER_ID);
    expect(getCurrentUserId("theme=dark; other=1")).toBe(DEFAULT_USER_ID);
  });

  it("x-user-id 쿠키 값을 읽는다", () => {
    expect(getCurrentUserId("theme=dark; x-user-id=dewy_day; other=1")).toBe("dewy_day");
  });

  it("URL 인코딩된 값은 디코딩하고 앞뒤 공백은 제거한다", () => {
    expect(getCurrentUserId("x-user-id=%EC%A0%9C%EB%A6%B0")).toBe("제린");
    expect(getCurrentUserId("x-user-id=%20glow_note%20")).toBe("glow_note");
  });

  it("값이 비어 있거나 공백뿐이면 기본 사용자", () => {
    expect(getCurrentUserId("x-user-id=")).toBe(DEFAULT_USER_ID);
    expect(getCurrentUserId("x-user-id=%20%20")).toBe(DEFAULT_USER_ID);
  });

  it("잘못된 인코딩은 원문을 쓴다", () => {
    expect(getCurrentUserId("x-user-id=%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("비슷한 이름의 쿠키와 혼동하지 않는다", () => {
    expect(getCurrentUserId("my-x-user-id=other; x-user-id-2=other")).toBe(DEFAULT_USER_ID);
  });

  it("인자가 없으면 document.cookie 를 읽는다", () => {
    document.cookie = "x-user-id=soft_toner; path=/";
    expect(getCurrentUserId()).toBe("soft_toner");
    document.cookie = "x-user-id=; path=/; max-age=0";
    expect(getCurrentUserId()).toBe(DEFAULT_USER_ID);
  });
});
