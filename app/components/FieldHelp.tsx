"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Round "?" button next to a form label; opens a small popup explaining the field. */
export default function FieldHelp({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        // Material Symbols "help" sized to the label's line height (see .field-help in globals.css).
        className="field-help"
        aria-label={`คำอธิบาย: ${title}`}
        aria-haspopup="dialog"
      >
        <span className="icon" aria-hidden="true">help</span>
      </button>
      {open && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-none flex items-center gap-2 px-6 py-4 border-b border-line">
              <h2 id={titleId} className="flex items-center gap-2 text-title-large text-ink">
                <span className="icon icon--24 text-primary" aria-hidden="true">help</span>
                {title}
              </h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="icon-button ml-auto" aria-label="ปิด">
                <span className="icon icon--24" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 text-body-medium text-ink">{children}</div>
            <div className="flex-none flex justify-end px-6 py-4 border-t border-line">
              <button type="button" onClick={() => setOpen(false)} className="btn-primary">เข้าใจแล้ว</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
