import { create } from "zustand";

const DEFAULT_DURATION_MS = 2_000;

type ToastState = {
  message: string | null;
  show: (message: string, durationMs?: number) => void;
  hide: () => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * 화면 이동을 넘어 유지되는 유일한 UI 상태(작성 완료 → 목록 이동 후 토스트).
 * mutation 의 onSuccess 처럼 컴포넌트 밖에서도 `useToast.getState().show(...)`로 호출할 수 있다.
 */
export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message, durationMs = DEFAULT_DURATION_MS) => {
    clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: null }), durationMs);
  },
  hide: () => {
    clearTimeout(timer);
    set({ message: null });
  },
}));
