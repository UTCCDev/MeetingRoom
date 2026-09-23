"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppHeader from "@/app/components/AppHeader";
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
  SYSTEM_ADMIN: "bg-red-100 text-red-800",
  ROOM_ADMIN: "bg-blue-100 text-blue-800",
  USER: "bg-gray-100 text-gray-800",
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
    `input-field ${formErrors[key] ? "border-red-500 focus:ring-red-500" : ""}`;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader
        title="จัดการผู้ใช้"
        breadcrumbs={[{ label: "จัดการผู้ใช้" }]}
        actions={
          <button onClick={openCreate} className="btn-primary">
            + เพิ่มผู้ใช้ใหม่
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-1">ค้นหา</label>
            <input
              id="user-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ชื่อหรืออีเมล"
              className="input-field"
            />
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="user-role-filter" className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
            <select
              id="user-role-filter"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">ทั้งหมด</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-gray-600 py-3">พบ {filtered.length} คน</p>
        </div>

        {isLoading ? (
          <SkeletonCards count={3} />
        ) : filtered.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500">ไม่พบผู้ใช้</p>
          </div>
        ) : (
          <>
            <div className="card overflow-x-auto p-0">
              <table className="w-full">
                <thead className="border-b bg-gray-100 text-sm">
                  <tr>
                    <th className="text-left py-3 px-4">ชื่อ-สกุล</th>
                    <th className="text-left py-3 px-4">อีเมล</th>
                    <th className="text-left py-3 px-4">บทบาท</th>
                    <th className="text-left py-3 px-4">สถานะ</th>
                    <th className="text-left py-3 px-4">วันที่สร้าง</th>
                    <th className="text-left py-3 px-4"><span className="sr-only">การจัดการ</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((user) => (
                    <tr key={user.id} className={`border-b hover:bg-white ${user.active ? "" : "text-gray-400"}`}>
                      <td className="py-3 px-4">
                        {user.name}
                        {user.id === myId && <span className="ml-2 text-xs text-gray-400">(คุณ)</span>}
                      </td>
                      <td className="py-3 px-4 break-all">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${ROLE_CLASS[user.role]}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {user.active ? (
                          <span className="text-emerald-700">ใช้งาน</span>
                        ) : (
                          <span className="text-gray-500">ปิดบัญชี</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm whitespace-nowrap">{formatDate(user.createdAt)}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openEdit(user)}
                          className="text-blue-700 hover:underline text-sm font-medium"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <nav className="flex items-center justify-center gap-2 mt-4" aria-label="เลือกหน้า">
                <button
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ‹ ก่อนหน้า
                </button>
                <span className="text-sm text-gray-600">
                  หน้า {currentPage} / {pageCount}
                </span>
                <button
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === pageCount}
                >
                  ถัดไป ›
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => !isSaving && setEditing(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="user-form-title" className="text-xl font-bold mb-4 text-blue-700">
              {editing === "new" ? "สร้างผู้ใช้ใหม่" : "แก้ไขผู้ใช้"}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm" role="alert">{formError}</div>
            )}

            <form onSubmit={handleSave} className="space-y-3" noValidate>
              <div>
                <label htmlFor="user-name" className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-สกุล *</label>
                <input
                  id="user-name"
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={fieldClass("name")}
                  aria-invalid={!!formErrors.name}
                />
                <p className="text-xs text-red-600 mt-1 min-h-[1rem]">{formErrors.name}</p>
              </div>

              <div>
                <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label>
                <input
                  id="user-email"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={fieldClass("email")}
                  aria-invalid={!!formErrors.email}
                />
                <p className="text-xs text-red-600 mt-1 min-h-[1rem]">{formErrors.email}</p>
              </div>

              <div>
                <label htmlFor="user-password" className="block text-sm font-medium text-gray-700 mb-1">
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
                <p className="text-xs mt-1 min-h-[1rem] text-red-600">
                  {formErrors.password || (
                    <span className="text-gray-500">อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร</span>
                  )}
                </p>
              </div>

              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  className="input-field"
                  disabled={isSelf}
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {isSelf && <p className="text-xs text-gray-500 mt-1">แก้ไขบทบาทตัวเองไม่ได้</p>}
              </div>

              {editing !== "new" && (
                <label className="flex items-center gap-2 text-sm pt-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateField("active", e.target.checked)}
                    disabled={isSelf}
                  />
                  เปิดใช้งานบัญชี (ปิดแล้วผู้ใช้จะเข้าสู่ระบบไม่ได้)
                </label>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary" disabled={isSaving}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-success disabled:opacity-50" disabled={isSaving}>
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
