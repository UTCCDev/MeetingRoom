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

const TONE_ICON = {
  danger: { name: "warning", className: "bg-[#FDF1F1] text-error" },
  primary: { name: "help", className: "bg-primary-container text-primary" },
  success: { name: "check_circle", className: "bg-[#EEF9F2] text-success" },
};

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
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-l shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${TONE_ICON[tone].className}`}
          aria-hidden="true"
        >
          <span className="icon icon--24 icon--w500">{TONE_ICON[tone].name}</span>
        </span>
        <h3 id="confirm-dialog-title" className="text-title-large text-ink mb-2">
          {title}
        </h3>
        <div className="text-body-small text-ink-muted mb-6">{children}</div>
        {/* Primary action sits on the right; 12px between buttons. */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-text" disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={TONE_CLASS[tone]}
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
