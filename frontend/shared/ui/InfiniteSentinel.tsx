"use client";

import { useEffect, useRef } from "react";

/**
 * 목록 끝에 두는 감시 요소. 화면에 들어오면(미리 200px 앞에서) onVisible 을 호출한다.
 * 다음 페이지가 없거나 불러오는 중이면 disabled 로 꺼서 중복 요청을 막는다.
 * 화면에 계속 보이는 상태에서 다시 켜지면 관찰이 새로 시작되어 곧바로 다음 페이지를 이어서 부른다.
 */
export function InfiniteSentinel({ onVisible, disabled = false }: { onVisible: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);

  useEffect(() => {
    callback.current = onVisible;
  });

  useEffect(() => {
    const element = ref.current;
    if (disabled || !element) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          callback.current();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [disabled]);

  return <div ref={ref} aria-hidden="true" data-testid="infinite-sentinel" className="h-px" />;
}
