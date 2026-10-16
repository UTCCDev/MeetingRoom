"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Splits a list into pages (design.md › Pagination): keeps `?page=` in the URL,
 * goes back to page 1 when `resetKey` (the filters) changes, and scrolls to the
 * top of the list when the page changes.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey: string = "") {
  const listRef = useRef<HTMLDivElement>(null);
  const [page, setPageState] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Math.max(1, Number(new URLSearchParams(window.location.search).get("page")) || 1);
  });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);

  const writeUrl = (p: number) => {
    const url = new URL(window.location.href);
    if (p > 1) url.searchParams.set("page", String(p));
    else url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", url);
  };

  const setPage = (p: number) => {
    setPageState(p);
    writeUrl(p);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // New filters → first page (skip the first render so a shared ?page= link still works).
  const firstKey = useRef(true);
  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    setPageState(1);
    writeUrl(1);
  }, [resetKey]);

  return {
    listRef,
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
    from: items.length === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, items.length),
  };
}

/** Page numbers to show: all up to 7, else first · current ±1 · last with "…" between. */
function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/**
 * Pagination (design.md › Pagination): circle 44px links, current = primary,
 * prev/next disabled (not hidden) at the ends, "21–40 จาก 236 รายการ" status,
 * and "หน้า 2 จาก 12" with prev/next on phones. Hidden when there's one page.
 */
export default function Pagination({
  page,
  pageCount,
  onChange,
  from,
  to,
  total,
  unit = "รายการ",
  className = "",
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  from: number;
  to: number;
  total: number;
  unit?: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const prev = (
    <button type="button" className="page-link" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="หน้าก่อนหน้า">
      <span className="icon" aria-hidden="true">chevron_left</span>
    </button>
  );
  const next = (
    <button type="button" className="page-link" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="หน้าถัดไป">
      <span className="icon" aria-hidden="true">chevron_right</span>
    </button>
  );

  return (
    <nav className={`flex flex-wrap items-center justify-between gap-4 mt-8 ${className}`} aria-label="เลือกหน้า">
      <p className="pagination__status hidden sm:block">
        {from}–{to} จาก {total} {unit}
      </p>

      {/* Phones: "หน้า 2 จาก 12" + prev / next */}
      <div className="pagination w-full justify-between sm:hidden">
        {prev}
        <span className="pagination__status">หน้า {page} จาก {pageCount}</span>
        {next}
      </div>

      <ul className="pagination hidden sm:flex">
        <li>{prev}</li>
        {pageList(page, pageCount).map((p, i) =>
          p === "…" ? (
            <li key={`e${i}`} className="page-ellipsis" aria-hidden="true">…</li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className="page-link"
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`หน้า ${p}`}
              >
                {p}
              </button>
            </li>
          )
        )}
        <li>{next}</li>
      </ul>
    </nav>
  );
}
