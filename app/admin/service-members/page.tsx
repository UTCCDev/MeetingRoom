"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import UserPicker, { type PickedUser } from "@/app/components/UserPicker";
import { useToast } from "@/app/components/Toast";
import { postJson } from "@/lib/service-client";
import { DEPT_LABEL, type Dept } from "@/lib/service-rules";

interface Member {
  id: string;
  userId: string;
  department: Dept;
  role: "ADMIN" | "STAFF";
  user: { id: string; name: string; email: string };
}

const DEPTS: Dept[] = ["AV", "HOUSEKEEPING"];
const ROLE_LABEL = { ADMIN: "หัวหน้างาน (ผู้ดูแล)", STAFF: "เจ้าหน้าที่" } as const;

export default function ServiceMembersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<PickedUser | null>(null);
  const [department, setDepartment] = useState<Dept>("AV");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const load = () =>
    fetch("/api/admin/service-members")
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .finally(() => setIsLoading(false));

  useEffect(() => {
    if (status === "authenticated") {
      if ((session?.user as any)?.role !== "SYSTEM_ADMIN") router.push("/");
      else load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await postJson("/api/admin/service-members", { userId: user.id, department, role });
      toast("บันทึกสมาชิกแล้ว", { type: "success" });
      setUser(null);
      await load();
    } catch (err) {
      toast((err as Error).message, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      await postJson(`/api/admin/service-members/${removing.id}/delete`);
      toast("ลบสมาชิกแล้ว", { type: "success" });
      await load();
    } catch (err) {
      toast((err as Error).message, { type: "error" });
    } finally {
      setSaving(false);
      setRemoving(null);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader title="สมาชิกงานบริการ" breadcrumbs={[{ label: "สมาชิกงานบริการ" }]} />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <form className="card space-y-4" onSubmit={add}>
          <div>
            <label htmlFor="sm-user" className="field-label">ผู้ใช้</label>
            <UserPicker inputId="sm-user" value={user} onChange={setUser} selfLabel="เลือกผู้ใช้" />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="sm-dept" className="field-label">แผนก</label>
              <select id="sm-dept" className="input-field" value={department} onChange={(e) => setDepartment(e.target.value as Dept)}>
                {DEPTS.map((d) => (
                  <option key={d} value={d}>{DEPT_LABEL[d]}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="sm-role" className="field-label">บทบาท</label>
              <select id="sm-role" className="input-field" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}>
                <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                <option value="STAFF">{ROLE_LABEL.STAFF}</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={!user || saving}>
            <span className="icon icon--20" aria-hidden="true">add</span>
            เพิ่มสมาชิก
          </button>
        </form>

        <div className="card">
          {isLoading ? (
            <p className="text-ink-subtle">กำลังโหลด...</p>
          ) : members.length === 0 ? (
            <p className="text-ink-subtle">ยังไม่มีสมาชิกงานบริการ</p>
          ) : (
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.id} className="py-3 flex flex-wrap items-center gap-3">
                  <span className="flex-1 min-w-[200px] break-words">
                    {m.user.name} <span className="text-body-small text-ink-subtle">· {m.user.email}</span>
                  </span>
                  <span className="badge-neutral">{DEPT_LABEL[m.department]}</span>
                  <span className={m.role === "ADMIN" ? "badge-primary" : "badge-neutral"}>{ROLE_LABEL[m.role]}</span>
                  <button type="button" className="btn-secondary" onClick={() => setRemoving(m)}>
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!removing}
        title="ลบสมาชิกงานบริการ?"
        tone="danger"
        confirmLabel="ลบ"
        busy={saving}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      >
        {removing && `${removing.user.name} จะไม่สามารถเข้าถึงงาน${DEPT_LABEL[removing.department]}ได้อีก`}
      </ConfirmDialog>
    </div>
  );
}
