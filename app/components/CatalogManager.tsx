"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/components/Toast";
import { postJson } from "@/lib/service-client";
import type { Dept } from "@/lib/service-rules";

interface Item {
  id: string;
  name: string;
  returnable: boolean;
  active: boolean;
  sortOrder: number;
}

interface Draft {
  id?: string;
  name: string;
  returnable: boolean;
  active: boolean;
  sortOrder: string;
}

const EMPTY: Draft = { name: "", returnable: false, active: true, sortOrder: "0" };

/** List, add, edit and switch on/off the equipment/service catalog of one department. */
export default function CatalogManager({ dept }: { dept: Dept }) {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      fetch(`/api/service-catalog/manage?dept=${dept}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setItems)
        .catch(() => setItems([])),
    [dept],
  );

  useEffect(() => {
    load();
  }, [load]);

  const save = async (d: Draft, message: string) => {
    setSaving(true);
    setError("");
    try {
      await postJson("/api/service-catalog/manage", {
        id: d.id,
        department: dept,
        name: d.name.trim(),
        returnable: d.returnable,
        active: d.active,
        sortOrder: Number.parseInt(d.sortOrder, 10) || 0,
      });
      toast(message, { type: "success" });
      setDraft(EMPTY);
      await load();
    } catch (e) {
      setError((e as Error).message);
      toast((e as Error).message, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(draft, draft.id ? "บันทึกรายการแล้ว" : "เพิ่มรายการแล้ว");
        }}
      >
        <h2 className="text-title-large text-ink">{draft.id ? "แก้ไขรายการ" : "เพิ่มรายการ"}</h2>
        {error && (
          <p className="field-error flex items-center gap-1" role="alert">
            <span className="icon icon--20" aria-hidden="true">error</span>
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="cat-name" className="field-label">ชื่อรายการ</label>
            <input id="cat-name" className="input-field" maxLength={100} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="w-28">
            <label htmlFor="cat-order" className="field-label">ลำดับ</label>
            <input
              id="cat-order"
              className="input-field"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value.replace(/[^\d-]/g, "") })}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.returnable} onChange={(e) => setDraft({ ...draft, returnable: e.target.checked })} />
            ต้องคืนอุปกรณ์
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            เปิดใช้งาน
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving || !draft.name.trim()}>
            <span className="icon icon--20" aria-hidden="true">{draft.id ? "save" : "add"}</span>
            {draft.id ? "บันทึก" : "เพิ่มรายการ"}
          </button>
          {draft.id && (
            <button type="button" className="btn-secondary" onClick={() => setDraft(EMPTY)} disabled={saving}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="card">
        {items === null ? (
          <p className="text-ink-subtle">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="text-ink-subtle">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="py-3 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[200px]">
                  {i.name}{" "}
                  <span className="text-body-small text-ink-subtle">
                    · ลำดับ {i.sortOrder}
                    {i.returnable && " · ต้องคืน"}
                  </span>
                </span>
                <span className={i.active ? "badge-available" : "badge-neutral"}>{i.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setError("");
                    setDraft({ id: i.id, name: i.name, returnable: i.returnable, active: i.active, sortOrder: String(i.sortOrder) });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() =>
                    save(
                      { id: i.id, name: i.name, returnable: i.returnable, active: !i.active, sortOrder: String(i.sortOrder) },
                      i.active ? "ปิดใช้งานรายการแล้ว" : "เปิดใช้งานรายการแล้ว",
                    )
                  }
                >
                  {i.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
