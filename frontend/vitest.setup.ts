import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { installIntersectionObserverMock } from "./test/intersection-observer";

installIntersectionObserverMock();

// vitest 는 globals 를 켜지 않아 Testing Library 의 자동 정리가 동작하지 않으므로 직접 등록한다.
afterEach(() => {
  cleanup();
});
