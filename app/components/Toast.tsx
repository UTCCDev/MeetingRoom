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
  success: "bg-success",
  error: "bg-error",
  info: "bg-ink",
};

const ICONS: Record<ToastType, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
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
            className={`${STYLES[t.type || "info"]} text-white rounded-sm shadow-lg pl-4 pr-1 py-1 min-h-[3.5rem] flex items-center gap-3`}
          >
            <span className="icon icon--24 icon--w500 icon--fill" aria-hidden="true">
              {ICONS[t.type || "info"]}
            </span>
            <span className="flex-1 text-body-small py-2">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="h-11 px-4 rounded-full text-label-large text-highlight hover:bg-white/10"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="ปิดการแจ้งเตือน"
              className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white/80 hover:text-white hover:bg-white/10"
            >
              <span className="icon icon--20" aria-hidden="true">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
