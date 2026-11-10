"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import { useToast } from "@/app/components/Toast";

interface Department {
  id: string;
  name: string;
  _count: { users: number };
}

async function send(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
  return data;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = () =>
    fetch("/api/admin/departments")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDepartments)
      .finally(() => setIsLoading(false));

  useEffect(() => {
    if (status === "authenticated") {
      if ((session?.user as any)?.role !== "SYSTEM_ADMIN") router.push("/");
      else load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast(done, { type: "success" });
      await load();
      return true;
    } catch (err) {
      toast((err as Error).message, { type: "error" });
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="จัดการแผนก" breadcrumbs={[{ label: "จัดการแผนก" }]} />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <form
          className="card flex flex-wrap gap-3 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            if (await run(() => send("/api/admin/departments", { name: newName.trim() }), "เพิ่มแผนกแล้ว")) setNewName("");
          }}
        >
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="dept-new" className="field-label">ชื่อแผนกใหม่</label>
            <input id="dept-new" className="input-field" value={newName} maxLength={100} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={!newName.trim()}>
            <span className="icon icon--20" aria-hidden="true">add</span>
            เพิ่มแผนก
          </button>
        </form>

        <div className="card">
          {isLoading ? (
            <p className="text-ink-subtle">กำลังโหลด...</p>
          ) : departments.length === 0 ? (
            <p className="text-ink-subtle">ยังไม่มีแผนก</p>
          ) : (
            <ul className="divide-y divide-line">
              {departments.map((d) => (
                <li key={d.id} className="py-3 flex flex-wrap items-center gap-3">
                  {editingId === d.id ? (
                    <input
                      className="input-field flex-1 min-w-[200px]"
                      value={editName}
                      maxLength={100}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label={`ชื่อใหม่ของ ${d.name}`}
                    />
                  ) : (
                    <span className="flex-1 min-w-[200px]">
                      {d.name} <span className="text-body-small text-ink-subtle">· {d._count.users} คน</span>
                    </span>
                  )}
                  {editingId === d.id ? (
                    <>
                      <button className="btn-secondary" onClick={() => setEditingId(null)}>ยกเลิก</button>
                      <button
                        className="btn-primary"
                        disabled={!editName.trim()}
                        onClick={async () => {
                          if (await run(() => send("/api/admin/departments/update", { id: d.id, name: editName.trim() }), "เปลี่ยนชื่อแผนกแล้ว"))
                            setEditingId(null);
                        }}
                      >
                        บันทึก
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setEditingId(d.id);
                          setEditName(d.name);
                        }}
                      >
                        เปลี่ยนชื่อ
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={d._count.users > 0}
                        title={d._count.users > 0 ? "มีผู้ใช้ในแผนกนี้ ลบไม่ได้" : undefined}
                        onClick={() => run(() => send("/api/admin/departments/delete", { id: d.id }), "ลบแผนกแล้ว")}
                      >
                        ลบ
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
