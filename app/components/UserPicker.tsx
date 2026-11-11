"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Dropdown, { type DropdownOption } from "@/app/components/Dropdown";

export interface PickedUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

const SELF = "__self__";

/**
 * "จองเพื่อ": a dropdown of users (name, then email · department) that opens on click
 * and narrows as you type. null = the signed-in user.
 */
export default function UserPicker({
  value,
  onChange,
  inputId = "booking-for",
  selfId,
  selfLabel = "ตัวฉันเอง",
}: {
  value: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  inputId?: string;
  /** Signed-in user's id, hidden from the list since "ตัวฉันเอง" covers it. */
  selfId?: string;
  /** Text of the null (no one picked) option. */
  selfLabel?: string;
}) {
  const [users, setUsers] = useState<PickedUser[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: PickedUser[]) => setUsers(list))
        .catch(() => {});
    }, query ? 250 : 0);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [query]);

  const onQueryChange = useCallback((q: string) => setQuery(q), []);

  const options: DropdownOption[] = [
    { value: SELF, label: selfLabel },
    ...users
      .filter((u) => u.id !== selfId)
      .map((u) => ({ value: u.id, label: u.name, hint: u.department ? `${u.email} · ${u.department}` : u.email })),
  ];

  return (
    <Dropdown
      id={inputId}
      options={options}
      value={value?.id ?? SELF}
      selectedLabel={value ? `${value.name} (${value.email})` : undefined}
      onQueryChange={onQueryChange}
      searchPlaceholder="พิมพ์ชื่อหรืออีเมล"
      onChange={(id) => onChange(id === SELF ? null : users.find((u) => u.id === id) ?? null)}
    />
  );
}
