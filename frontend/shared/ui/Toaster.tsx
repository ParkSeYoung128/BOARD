"use client";

import { useToast } from "@/shared/store/toast";

export function Toaster() {
  const message = useToast((state) => state.message);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto flex w-full max-w-[375px] justify-center px-4" role="status" aria-live="polite">
      {message ? (
        <div className="max-w-full break-words rounded-full bg-toast px-5 py-2.5 text-center text-[14px] text-white">{message}</div>
      ) : null}
    </div>
  );
}
