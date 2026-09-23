"use client";

import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface Toast extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const STYLES: Record<ToastType, string> = {
  success: "bg-emerald-600",
  error: "bg-rose-600",
  info: "bg-gray-800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts, { id, message, ...options }]);
      setTimeout(() => dismiss(id), options.duration ?? 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${STYLES[t.type || "info"]} text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3`}
          >
            <span className="flex-1 text-sm">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="text-sm font-semibold underline underline-offset-2 hover:opacity-80"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="ปิดการแจ้งเตือน"
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
