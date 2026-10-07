import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * 테스트용 QueryClient 로 감싸 렌더링한다. 재시도는 끄고(실패를 바로 확인), 캐시는 테스트마다 새로 만든다.
 * `prepare` 는 렌더링 직전에 캐시를 채울 때 쓴다(예: 목록에서 상세로 들어온 상황).
 */
export function renderWithQuery(ui: ReactElement, prepare?: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  prepare?.(client);
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...result };
}
