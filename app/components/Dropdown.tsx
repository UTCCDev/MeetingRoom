"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePopoverPlacement } from "@/app/components/usePopoverPlacement";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string; // second line, e.g. an email
  disabled?: boolean;
}

/** Above this many options the menu gets a search box (design.md › Dropdown). */
const SEARCH_FROM = 10;

/**
 * Custom select per design.md › Dropdown: 48px trigger, listbox menu, ↑ ↓ Enter Esc,
 * click outside closes. Use the native `select.input-field` for short plain lists;
 * this one is for long lists that need search.
 */
export default function Dropdown({
  id,
  options,
  value,
  onChange,
  placeholder = "เลือก",
  invalid = false,
  disabled = false,
  searchPlaceholder = "ค้นหา",
  searchable: searchableProp,
  className = "",
  "aria-describedby": describedBy,
}: {
  id: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  /** Defaults to a search box above 10 options; pass false for lists like times. */
  searchable?: boolean;
  className?: string;
  "aria-describedby"?: string;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  // Flips above the trigger near the bottom of the screen and caps its height to fit.
  const placement = usePopoverPlacement(open, triggerRef, menuRef);

  const selected = options.find((o) => o.value === value);
  const searchable = searchableProp ?? options.length > SEARCH_FROM;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint || ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const openMenu = () => {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const choose = (o?: DropdownOption) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  };
  const move = (step: number) => {
    if (shown.length === 0) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  };

  // Focus the search box (or keep focus on the trigger) when the menu opens.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the active option in view by moving the menu's scrollTop (not scrollIntoView,
  // which would also scroll the dialog behind it).
  useEffect(() => {
    const menu = menuRef.current;
    const el = menu?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!menu || !el) return;
    const search = menu.querySelector<HTMLElement>(".dropdown__search");
    const top = el.offsetTop - (search?.offsetHeight || 0) - 8;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (el.offsetTop + el.offsetHeight > menu.scrollTop + menu.clientHeight)
      menu.scrollTop = el.offsetTop + el.offsetHeight - menu.clientHeight + 8;
  }, [active, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(shown[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  };

  const activeId = open && shown[active] ? `${menuId}-${active}` : undefined;

  return (
    <div ref={rootRef} className={`dropdown ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={searchable ? undefined : activeId}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className={`dropdown__value ${selected ? "" : "dropdown__value--placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="icon icon--24" aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <ul ref={menuRef} id={menuId} className="dropdown__menu" role="listbox" aria-labelledby={id} style={placement.style}>
          {searchable && (
            <li className="dropdown__search" role="presentation">
              <input
                ref={searchRef}
                type="search"
                className="input-field !h-10"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={menuId}
                aria-activedescendant={activeId}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
              />
            </li>
          )}
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${menuId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={`dropdown__option ${i === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              <span className="min-w-0">
                {o.label}
                {o.hint && <span className="dropdown__option-hint">{o.hint}</span>}
              </span>
              {o.value === value && (
                <span className="icon icon--24 dropdown__check" aria-hidden="true">check</span>
              )}
            </li>
          ))}
          {shown.length === 0 && (
            <li className="dropdown__empty" role="presentation">ไม่พบรายการที่ค้นหา</li>
          )}
        </ul>
      )}
    </div>
  );
}
