"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Pagination from "@/app/components/Pagination";
import AppHeader from "@/app/components/AppHeader";
import Dropdown from "@/app/components/Dropdown";
import { SkeletonCards } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import { formatDate } from "@/lib/format";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const PAGE_SIZE = 10;
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_LABELS: Record<string, string> = {
  USER: "ผู้ใช้ทั่วไป",
  ROOM_ADMIN: "ผู้ดูแลห้อง",
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
};

const ROLE_CLASS: Record<string, string> = {
  SYSTEM_ADMIN: "badge--info",
  ROOM_ADMIN: "badge-primary",
  USER: "badge-neutral",
};

const ROLE_HINTS: Record<string, string> = {
  USER: "จองห้องได้",
  ROOM_ADMIN: "อนุมัติการจองห้องที่ดูแล",
  SYSTEM_ADMIN: "จัดการห้องและผู้ใช้ทั้งหมด",
};

const ROLE_ICONS: Record<string, string> = {
  SYSTEM_ADMIN: "shield_person",
  ROOM_ADMIN: "manage_accounts",
  USER: "person",
};

type FormState = { name: string; email: string; password: string; role: string; active: boolean };
const EMPTY_FORM: FormState = { name: "", email: "", password: "", role: "USER", active: true };

function validate(form: FormState, isCreate: boolean): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.name.trim()) errors.name = "กรุณากรอกชื่อ-สกุล";
  if (!form.email.trim()) errors.email = "กรุณากรอกอีเมล";
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (isCreate && !form.password) errors.password = "กรุณากรอกรหัสผ่าน";
  else if (form.password && form.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
  }
  return errors;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  // null = closed, "new" = create, otherwise the user being edited
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const myId = (session?.user as any)?.id;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole !== "SYSTEM_ADMIN") {
        router.push("/");
      } else {
        fetchUsers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) throw new Error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (!roleFilter || u.role === roleFilter)
    );
  }, [users, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageUsers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreate = () => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError("");
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role, active: user.active });
    setFormErrors({});
    setFormError("");
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
    setFormError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const isCreate = editing === "new";
    const errors = validate(form, isCreate);
    setFormErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setIsSaving(true);
    try {
      const payload = isCreate
        ? { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role }
        : {
            userId: editing.id,
            name: form.name.trim(),
            email: form.email.trim(),
            newRole: form.role,
            active: form.active,
            ...(form.password && { password: form.password }),
          };

      const response = await fetch("/api/admin/users", {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");

      toast(isCreate ? "สร้างผู้ใช้แล้ว" : "บันทึกข้อมูลผู้ใช้แล้ว", { type: "success" });
      setEditing(null);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const isSelf = editing !== null && editing !== "new" && editing.id === myId;

  const fieldClass = (key: keyof FormState) =>
    `input-field ${formErrors[key] ? "border-error" : ""}`;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        title="จัดการผู้ใช้"
        breadcrumbs={[{ label: "จัดการผู้ใช้" }]}
        actions={
          <button onClick={openCreate} className="btn-primary">
            <span className="icon icon--20" aria-hidden="true">person_add</span>
            เพิ่มผู้ใช้ใหม่
          </button>
        }
      />

      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="alert alert--error mb-4" role="alert">
            <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
            {error}
          </div>
        )}

        <div className="card mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="user-search" className="field-label">ค้นหา</label>
            <div className="relative">
            <span
              className="icon icon--20 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id="user-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ชื่อหรืออีเมล"
              className="input-field pl-11"
            />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="user-role-filter" className="field-label">บทบาท</label>
            <Dropdown
              id="user-role-filter"
              value={roleFilter}
              onChange={(v) => {
                setRoleFilter(v);
                setPage(1);
              }}
              options={[
                { value: "", label: "ทั้งหมด" },
                ...Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l })),
              ]}
            />
          </div>
          <p className="text-body-small text-ink-muted h-12 flex items-center">พบ <strong className="font-bold text-ink tabular-nums mx-1">{filtered.length}</strong> คน</p>
        </div>

        {isLoading ? (
          <SkeletonCards count={3} />
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <span className="icon icon--40 text-ink-subtle" aria-hidden="true">person_search</span>
            <p>ไม่พบผู้ใช้</p>
          </div>
        ) : (
          <>
            <div className="card relative overflow-x-auto p-0 sm:p-0">
              <table className="table min-w-[52rem]">
                <thead>
                  <tr>
                    <th>ชื่อ-สกุล</th>
                    <th>อีเมล</th>
                    <th>บทบาท</th>
                    <th>สถานะ</th>
                    <th>วันที่สร้าง</th>
                    <th><span className="sr-only">การจัดการ</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((user) => (
                    <tr key={user.id} className={user.active ? "" : "opacity-60"}>
                      <td>
                        <span className="text-title-small text-ink">{user.name}</span>
                        {user.id === myId && <span className="ml-2 text-body-small text-ink-subtle">(คุณ)</span>}
                      </td>
                      <td className="whitespace-nowrap">{user.email}</td>
                      <td>
                        <span className={ROLE_CLASS[user.role] || "badge-neutral"}>
                          <span className="icon icon--20" aria-hidden="true">{ROLE_ICONS[user.role] || "person"}</span>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td>
                        {user.active ? (
                          <span className="badge-available">
                            <span className="icon icon--20" aria-hidden="true">check_circle</span>
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="badge-neutral">
                            <span className="icon icon--20" aria-hidden="true">block</span>
                            ปิดบัญชี
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(user.createdAt)}</td>
                      <td className="text-right">
                        <button
                          onClick={() => openEdit(user)}
                          className="icon-button"
                          aria-label={`แก้ไข ${user.name}`}
                          title="แก้ไข"
                        >
                          <span className="icon icon--24" aria-hidden="true">edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              from={(currentPage - 1) * PAGE_SIZE + 1}
              to={Math.min(currentPage * PAGE_SIZE, filtered.length)}
              total={filtered.length}
              unit="คน"
            />
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={() => !isSaving && setEditing(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="user-form-title" className="flex items-center gap-2 text-title-large text-ink mb-5">
              <span className="icon icon--24 text-primary" aria-hidden="true">
                {editing === "new" ? "person_add" : "manage_accounts"}
              </span>
              {editing === "new" ? "สร้างผู้ใช้ใหม่" : "แก้ไขผู้ใช้"}
            </h2>

            {formError && (
              <div className="alert alert--error mb-4" role="alert">
                <span className="icon icon--24 icon--error" aria-hidden="true">error</span>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6" noValidate>
              <div>
                <label htmlFor="user-name" className="field-label">ชื่อ-สกุล *</label>
                <input
                  id="user-name"
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={fieldClass("name")}
                  aria-invalid={!!formErrors.name}
                />
                {formErrors.name && <p className="field-error">{formErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="user-email" className="field-label">อีเมล *</label>
                <input
                  id="user-email"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={fieldClass("email")}
                  aria-invalid={!!formErrors.email}
                />
                {formErrors.email && <p className="field-error">{formErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="user-password" className="field-label">
                  {editing === "new" ? "รหัสผ่าน *" : "รีเซ็ตรหัสผ่าน"}
                </label>
                <input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className={fieldClass("password")}
                  aria-invalid={!!formErrors.password}
                  placeholder={editing === "new" ? "" : "เว้นว่างไว้หากไม่เปลี่ยน"}
                />
                {formErrors.password ? (
                  <p className="field-error">{formErrors.password}</p>
                ) : (
                  <p className="field-hint">อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร</p>
                )}
              </div>

              {/* 3 options → radio cards (design.md › Radio button: 2–5 options). */}
              <fieldset>
                <legend className="field-label">บทบาท</legend>
                <div className="radio-group--cards">
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <label key={v} className="radio radio--card">
                      <input
                        type="radio"
                        name="user-role"
                        value={v}
                        checked={form.role === v}
                        onChange={() => updateField("role", v)}
                        disabled={isSelf}
                      />
                      <span className="radio__text">
                        {l}
                        <span className="radio__hint">{ROLE_HINTS[v]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {isSelf && <p className="field-hint">แก้ไขบทบาทตัวเองไม่ได้</p>}
              </fieldset>

              {editing !== "new" && (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateField("active", e.target.checked)}
                    disabled={isSelf}
                  />
                  เปิดใช้งานบัญชี (ปิดแล้วผู้ใช้จะเข้าสู่ระบบไม่ได้)
                </label>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditing(null)} className="btn-text" disabled={isSaving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  <span className="icon icon--20" aria-hidden="true">save</span>
                  {isSaving ? "กำลังบันทึก..." : editing === "new" ? "สร้างผู้ใช้" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
