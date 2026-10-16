"use client";

import { useEffect, useRef, useState } from "react";

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"])';

/**
 * Floating "back to top" button, bottom-right. Shows after scrolling one screen and
 * steps aside (fades out) whenever it would sit on top of something clickable, such as
 * the booking form's submit button or the pagination, so pages need no extra bottom space.
 */
export default function BackToTop() {
  const ref = useRef<HTMLButtonElement>(null);
  const [scrolledDown, setScrolledDown] = useState(false);
  const [overlapping, setOverlapping] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setScrolledDown(window.scrollY > window.innerHeight * 0.6);
      const btn = ref.current;
      if (!btn) return;
      // Look under the button (plus an 8px margin) at its corners and center.
      const r = btn.getBoundingClientRect();
      const m = 8;
      const xs = [r.left - m, r.left + r.width / 2, r.right + m];
      const ys = [r.top - m, r.top + r.height / 2, r.bottom + m];
      const hit = xs.some((x) =>
        ys.some((y) =>
          document.elementsFromPoint(x, y).some((el) => {
            if (btn.contains(el)) return false;
            const target = el.closest<HTMLElement>(INTERACTIVE);
            if (!target) return false;
            // Only small controls count: a whole-card link stays easy to click around the button.
            const t = target.getBoundingClientRect();
            return t.height <= 96 || t.width <= 200;
          })
        )
      );
      setOverlapping(hit);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Content that loads or expands after a scroll (lists, forms) can move under the button too.
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, []);

  const show = scrolledDown && !overlapping;

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={toTop}
      aria-label="กลับขึ้นด้านบน"
      title="กลับขึ้นด้านบน"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`back-to-top fixed z-30 right-4 bottom-4 sm:right-6 sm:bottom-6 inline-flex items-center justify-center w-14 h-14 rounded-full
        bg-primary text-on-primary shadow-[var(--shadow-2)] hover:bg-primary-50 active:bg-primary-30
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
        transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
    >
      <span className="icon icon--24" aria-hidden="true">arrow_upward</span>
    </button>
  );
}
