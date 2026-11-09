"use client";

import { useEffect, useState } from "react";

export interface PickedUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

/** "จองเพื่อ": null means the signed-in user; otherwise a user found by name or email. */
export default function UserPicker({
  value,
  onChange,
  inputId,
}: {
  value: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  inputId?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: PickedUser[]) => setResults(list))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (value) {
    return (
      <div className="input-field flex items-center justify-between gap-2">
        <span className="truncate">
          {value.name} <span className="text-ink-subtle">({value.department || value.email})</span>
        </span>
        <button type="button" className="text-sm underline shrink-0" onClick={() => onChange(null)}>
          เปลี่ยนเป็นตัวฉันเอง
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input-field"
        placeholder="ตัวฉันเอง — หรือพิมพ์ชื่อ/อีเมลเพื่อจองให้ผู้อื่น"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded border bg-white dark:bg-neutral-900 shadow" role="listbox">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-black/5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(u);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div>{u.name}</div>
                <div className="text-sm text-ink-subtle">
                  {u.email}
                  {u.department ? ` · ${u.department}` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
