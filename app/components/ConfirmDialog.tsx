"use client";

import { ReactNode, useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary" | "success";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_CLASS = {
  danger: "btn-danger",
  primary: "btn-primary",
  success: "btn-success",
};

/** Modal used for every confirm step (same look as the delete-room dialog). */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-gray-900 mb-2">
          {title}
        </h3>
        <div className="text-gray-600 mb-6">{children}</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${TONE_CLASS[tone]} disabled:opacity-50`}
            disabled={busy}
            autoFocus
          >
            {busy ? "กำลังดำเนินการ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
