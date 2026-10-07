"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/shared/api/client";

/** 4xx 는 다시 시도해도 같은 결과이므로 재시도하지 않는다. 네트워크 오류·5xx 만 한 번 더 시도한다. */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // 렌더마다 새로 만들지 않도록 state 로 한 번만 생성한다.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: shouldRetry },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
