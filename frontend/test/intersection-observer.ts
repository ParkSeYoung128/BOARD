import { act } from "@testing-library/react";

/**
 * jsdom 에는 IntersectionObserver 가 없어 테스트용 대역을 둔다. vitest.setup.ts 에서 전역으로 설치한다.
 * 화면에 들어온 상황은 `intersectAll()` 로 만든다. 관찰 중인 요소가 없으면(센티널이 꺼진 상태) 아무 일도 일어나지 않는다.
 */
const observers = new Set<MockIntersectionObserver>();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  private readonly elements = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.add(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
    observers.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  observes(selector: string) {
    return [...this.elements].some((element) => element.matches(selector));
  }

  intersect() {
    if (this.elements.size === 0) {
      return;
    }
    const entries = [...this.elements].map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry);
    this.callback(entries, this);
  }
}

export function installIntersectionObserverMock() {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

/** 관찰 중인 모든 요소가 화면에 들어온 것으로 본다. */
export function intersectAll() {
  act(() => {
    for (const observer of [...observers]) {
      observer.intersect();
    }
  });
}

/**
 * 무한 스크롤 센티널을 관찰 중인 관찰자 수(켜져 있으면 1, disabled 로 꺼지면 0).
 * next/link 도 프리페치용으로 IntersectionObserver 를 쓰므로 전체 개수가 아니라 센티널만 센다.
 */
export function activeSentinelCount() {
  return [...observers].filter((observer) => observer.observes('[data-testid="infinite-sentinel"]')).length;
}
