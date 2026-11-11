# Service Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AV (แผนกโสต) and housekeeping (กองอาคาร) service requests, attached to bookings or standalone, with department admin/staff queues, bell notifications and email.

**Architecture:** One generic `ServiceRequest` model keyed by `ServiceDepartment`. All permission and rule decisions are pure functions in `lib/service-rules.ts` (vitest). API routes under `app/api/service-requests/**` load the actor plus their `ServiceMember` rows and call those functions. Booking routes call one hook module (`lib/service-booking-sync.ts`) on approve/reject/cancel. Notifications stay derived (no table), merged into the existing `/api/notifications`.

**Tech Stack:** Next.js 15 App Router, Prisma 3 (MySQL), next-auth JWT, zod, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-service-requests-design.md`

## Global Constraints

- **Never touch the production DB.** Prisma CLI only through `npm run db:dev:*` (local MySQL, `.env.development.local`).
- UI text and API errors in Thai, matching existing tone.
- Production blocks PUT/DELETE: use POST routes only (e.g. `/api/service-requests/[id]/accept`).
- User includes always `{ select: { id, name, email } }` — never the password hash.
- Times: parse with existing `bangkokDate`; "calendar day" math in Asia/Bangkok.
- Email failures are logged, never undo a DB change; emails are not awaited in the request path.
- Unauthorized view of a request → 404, not 403 (existing convention).
- Concurrent status changes use conditional `updateMany({ where: { id, status: <expected> } })`; `count === 0` → 409 `"คำร้องนี้ถูกเปลี่ยนสถานะแล้ว"`.
- Uploads: ≤5 MB, ≤5 files per request, detected by magic bytes (jpg/png/webp/pdf), stored in `uploads/service/` (outside `public/`), served only to people who can view the request.

## Review Focus

1. Booking still PENDING → department admin lists/GET by id must not return its request (404), and no "new request" notification until approval.
2. Booking rejected → request becomes CANCELLED and never appears in any department list or notification ("cancelled" notification only when `visibleAt` was set).
3. Lead time at Bangkok midnight boundary: usage at `today+3 00:30 (+07:00)` allowed; `today+2 23:30` rejected, regardless of server timezone being UTC.
4. Same user is STAFF in AV and ADMIN in HOUSEKEEPING → AV queue shows only assigned requests; HOUSEKEEPING shows all.
5. Attachment URL guessed by a stranger → 404.

---

### Task 1: Schema, migration, catalog seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261111000000_service_requests/migration.sql` (via `npm run db:dev:migrate -- --name service_requests`, then rename folder to this timestamp if needed)
- Create: `scripts/seed-service-catalog.js`

**Produces (Prisma models):**
```prisma
enum ServiceDepartment { AV HOUSEKEEPING }
enum ServiceMemberRole { ADMIN STAFF }
enum ServiceStatus { PENDING ACCEPTED IN_PROGRESS DONE REJECTED CANCELLED }

model ServiceMember {
  id String @id @default(cuid())
  userId String
  department ServiceDepartment
  role ServiceMemberRole
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, department])
  @@map("service_members")
}

model ServiceCatalogItem {
  id String @id @default(cuid())
  department ServiceDepartment
  name String
  returnable Boolean @default(false)
  active Boolean @default(true)
  sortOrder Int @default(0)
  @@unique([department, name])
  @@map("service_catalog_items")
}

model ServiceRequest {
  id String @id @default(cuid())
  department ServiceDepartment
  status ServiceStatus @default(PENDING)
  requesterId String
  createdById String          // differs from requester when a dept admin files it
  bookingId String?
  location String?            // required when bookingId is null
  startTime DateTime          // copied from booking when linked
  endTime DateTime
  contactPhone String
  note String? @db.Text
  visibleAt DateTime?         // when the department could first see it; null = hidden
  assigneeId String?
  assignedAt DateTime?
  coordinatorName String?
  coordinatorPhone String?
  borrowedAt DateTime?
  returnedAt DateTime?
  internalNote String? @db.Text
  rejectionReason String?
  decidedAt DateTime?         // last status change by department (accept/reject/progress/done)
  cancelledAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  requester User @relation("ServiceRequester", ...)
  createdBy User @relation("ServiceCreatedBy", ...)
  assignee User? @relation("ServiceAssignee", ..., onDelete: SetNull)
  booking Booking? @relation(..., onDelete: Cascade)
  items ServiceRequestItem[]
  attachments ServiceAttachment[]
  @@unique([bookingId, department])
  @@index([department, status, startTime])
  @@map("service_requests")
}

model ServiceRequestItem {
  id String @id @default(cuid())
  requestId String
  catalogItemId String?       // null = "อื่น ๆ"
  otherText String?
  qty Int
  request ServiceRequest @relation(..., onDelete: Cascade)
  catalogItem ServiceCatalogItem? @relation(..., onDelete: SetNull)
  @@map("service_request_items")
}

model ServiceAttachment {
  id String @id @default(cuid())
  requestId String
  fileName String             // stored name: uuid.ext
  originalName String
  mime String
  size Int
  request ServiceRequest @relation(..., onDelete: Cascade)
  @@map("service_attachments")
}
```
Add back-relations on `User` and `Booking` (`serviceRequests ServiceRequest[]`).

- [ ] **Step 1:** Edit schema as above; run `npm run db:dev:migrate -- --name service_requests`. Expected: migration created and applied, `prisma generate` succeeds.
- [ ] **Step 2:** Write `scripts/seed-service-catalog.js` that upserts the spec's seed list by `(department, name)` with `returnable` per spec and `sortOrder` in listed order. Run `node scripts/seed-service-catalog.js` against dev DB twice. Expected: 13 rows, second run changes nothing.
- [ ] **Step 3:** `npx tsc --noEmit` passes. Commit `feat: service request schema and catalog seed`.

---

### Task 2: Pure rules `lib/service-rules.ts`

**Files:**
- Create: `lib/service-rules.ts`
- Test: `tests/service-rules.test.ts`

**Produces:**
```ts
export type Dept = "AV" | "HOUSEKEEPING";
export type SStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";
export type Membership = { department: Dept; role: "ADMIN" | "STAFF" };
export const DEPT_LABEL: Record<Dept, string>; // { AV: "แผนกโสต", HOUSEKEEPING: "กองอาคาร" }
export const LEAD_DAYS = 3;
export const CANCEL_CUTOFF_HOURS = 24;
export function membershipIn(ms: Membership[], d: Dept): Membership | null;
export function meetsLeadTime(start: Date, now: Date): boolean;        // Bangkok calendar days
export function canTransitionService(from: SStatus, to: SStatus): boolean;
export function canRequesterCancel(r: { status: SStatus; startTime: Date }, now: Date): boolean;
export function canViewRequest(userId: string, ms: Membership[], r: { requesterId: string; department: Dept; visibleAt: Date | null; assigneeId: string | null }): boolean;
export function canManage(ms: Membership[], d: Dept): boolean;         // ADMIN only
export function canWork(userId: string, ms: Membership[], r: { department: Dept; assigneeId: string | null }): boolean; // ADMIN, or STAFF assignee
export function queueWhere(userId: string, m: Membership): Record<string, unknown>; // ADMIN: {department, visibleAt: {not: null}}; STAFF: + {assigneeId: userId}
export const createServiceSchema: z.ZodType; // see Task 4
```

Transitions: PENDING→ACCEPTED|REJECTED|CANCELLED, ACCEPTED→IN_PROGRESS|CANCELLED, IN_PROGRESS→DONE.

- [ ] **Step 1: Write failing tests** (one `it` each):
  - `meetsLeadTime`: now = `2026-11-11T23:00+07:00`; start `2026-11-14T00:30+07:00` → true; `2026-11-13T23:30+07:00` → false.
  - `canTransitionService`: allowed list true; `DONE→PENDING`, `REJECTED→ACCEPTED`, `IN_PROGRESS→CANCELLED` false.
  - `canRequesterCancel`: PENDING 1 h before start → true; ACCEPTED 25 h before → true; ACCEPTED 23 h before → false; IN_PROGRESS → false; after start → false.
  - `canViewRequest`: requester true even with `visibleAt: null`; dept ADMIN with `visibleAt: null` → false; dept ADMIN visible → true; STAFF not assignee → false; STAFF assignee → true; ADMIN of other dept → false.
  - `queueWhere`: STAFF in AV gets `assigneeId`; ADMIN does not; both include `visibleAt: { not: null }`.
- [ ] **Step 2:** `npx vitest run tests/service-rules.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement. Lead time: compare Bangkok date strings (`toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })`) of `start` vs `now + 3 days`.
- [ ] **Step 4:** Tests PASS. Commit `feat: service request rules`.

---

### Task 3: Attachment storage

**Files:**
- Modify: `lib/uploads.ts` — add `SERVICE_UPLOAD_DIR = uploads/service`, `fileType(b): { ext: "jpg"|"png"|"webp"|"pdf"; mime } | null` (PDF = bytes `%PDF-`), `SERVICE_UPLOAD_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/`.
- Create: `lib/service-attachments.ts` — `saveServiceFiles(files: File[]): Promise<{fileName, originalName, mime, size}[]>` throws `UploadError(message)` for >5 files, >5 MB, unknown type.
- Create: `app/api/service-requests/[id]/attachments/[name]/route.ts` — GET streams file if `canViewRequest`, else 404.
- Test: `tests/service-attachments.test.ts`

- [ ] **Step 1: Failing tests:** `fileType` detects `%PDF-1.7` → pdf; text file → null; `saveServiceFiles` with 6 files throws `"แนบไฟล์ได้ไม่เกิน 5 ไฟล์"`; 6 MB → `"ไฟล์ใหญ่เกิน 5 MB"`; `.exe` bytes → `"รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WebP"`. Route: stranger → 404; requester → 200 with `Content-Type: application/pdf` and `Content-Disposition: inline`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (mock `fs/promises` in tests). **Step 4:** PASS. Commit `feat: service request attachments`.

---

### Task 4: Create, list, view requests

**Files:**
- Create: `lib/service-actor.ts` — `loadServiceActor(session): Promise<(Actor & { memberships: Membership[] }) | null>`
- Create: `app/api/service-requests/route.ts` — `POST` (multipart: field `data` JSON + `files[]`), `GET ?scope=mine|queue&dept=AV&status=PENDING&from=&to=`
- Create: `app/api/service-requests/[id]/route.ts` — `GET`
- Create: `app/api/service-catalog/route.ts` — `GET ?dept=` active items (any signed-in user)
- Test: `tests/api-service-requests.test.ts`

**createServiceSchema** (`lib/service-rules.ts`): `{ department, bookingId?, location?, startTime?, endTime?, contactPhone (1–30), note? (≤1000), requesterId? (admin only), items: [{ catalogItemId?, otherText? (≤100), qty int 1–999 }] min 1 }`; refine: each item has exactly one of catalogItemId / otherText; without bookingId, location+startTime+endTime required and end > start.

POST behavior:
- `bookingId` given: booking must be owned by or booked for the actor (else 404), status PENDING or APPROVED, not ended; times copied from booking; `visibleAt = booking.status === "APPROVED" ? now : null`.
- No booking: `visibleAt = now`.
- `requesterId` accepted only when actor `canManage(dept)`; then lead time skipped.
- Otherwise `meetsLeadTime` must pass → 400 `"ต้องขอล่วงหน้าอย่างน้อย 3 วันก่อนวันใช้งาน"`.
- Catalog ids must be active items of the same department → 400 `"รายการอุปกรณ์ไม่ถูกต้อง"`.
- Duplicate `(bookingId, department)` → 409 `"การจองนี้มีคำร้อง${DEPT_LABEL}อยู่แล้ว"`.
- If `visibleAt` set → `notifyNewRequest(id)` (Task 7; stub import, not awaited).

GET list: `scope=mine` → requester = me; `scope=queue` → needs membership in `dept` else 403, where = `queueWhere`. Include items+catalog name, requester, assignee, booking `{ id, title, room: { name } }`. Each row adds computed `waitingRoom: visibleAt === null && status === "PENDING"`.

- [ ] **Step 1: Failing tests:** lead-time rejection (400 + message); admin on-behalf bypasses lead time and sets `requesterId`/`createdById`; non-admin `requesterId` ignored→ 403 `"คุณไม่มีสิทธิ์ยื่นคำร้องแทนผู้อื่น"`; booking PENDING → `visibleAt: null`; booking APPROVED → `visibleAt` set; someone else's booking → 404; duplicate → 409; inactive catalog item → 400; GET by id as AV admin on hidden request → 404 (Review Focus 1); queue as AV STAFF passes `assigneeId` filter (Review Focus 4).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: create and list service requests`.

---

### Task 5: Department actions

**Files:**
- Create: `app/api/service-requests/[id]/accept/route.ts` — POST `{ assigneeId, coordinatorName?, coordinatorPhone?, internalNote? }` (ADMIN; assignee must be member of dept) PENDING→ACCEPTED, sets `assignedAt`, `decidedAt`
- Create: `.../[id]/reject/route.ts` — POST `{ reason (1–500) }` ADMIN, PENDING→REJECTED
- Create: `.../[id]/progress/route.ts` — POST `{ borrowedAt? }` `canWork`, ACCEPTED→IN_PROGRESS, `borrowedAt` default now
- Create: `.../[id]/done/route.ts` — POST `{ returnedAt? }` `canWork`, IN_PROGRESS→DONE; if any item returnable and no `returnedAt` → 400 `"กรุณาระบุวันที่คืนอุปกรณ์"`
- Create: `.../[id]/update/route.ts` — POST ADMIN edits coordinator/assignee/internalNote/borrowedAt/returnedAt without status change; reassign updates `assignedAt`
- Test: `tests/api-service-actions.test.ts`

All: request must be visible (`visibleAt` not null) else 404; wrong status → 409; status change via conditional `updateMany`. After success fire Task 7 notifier (`notifyDecision(id)` for accept/reject/done, `notifyAssigned(id)` for accept/reassign).

- [ ] **Step 1: Failing tests:** accept without assignee → 400; assignee not in dept → 400 `"ผู้รับผิดชอบต้องเป็นเจ้าหน้าที่ของ${DEPT_LABEL}"`; STAFF calling accept → 403; STAFF assignee progress → 200; other STAFF → 404; done with returnable item and no returnedAt → 400; concurrent accept (`count: 0`) → 409; reject empty reason → 400.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: department actions on service requests`.

---

### Task 6: Requester cancel and booking sync

**Files:**
- Create: `app/api/service-requests/[id]/cancel/route.ts` — requester only (else 404), `canRequesterCancel` else 409 `"ยกเลิกได้ถึง 24 ชม. ก่อนเวลาใช้งาน กรุณาติดต่อเจ้าหน้าที่"`; sets `cancelledAt`
- Create: `lib/service-booking-sync.ts`:
  - `onBookingApprovedServices(bookingId): Promise<void>` — set `visibleAt = now` on PENDING requests with null `visibleAt`; notify new request for each
  - `onBookingClosedServices(bookingId, kind: "REJECTED" | "CANCELLED"): Promise<void>` — cancel PENDING/ACCEPTED requests; notify cancellation only for those with `visibleAt` set
- Modify: `lib/booking-approval.ts` `onBookingApproved` — call `onBookingApprovedServices` (covers auto-approve and admin approve)
- Modify: `app/api/bookings/[id]/route.ts` — after reject (~line 94 block) and cancel (~line 170) call `onBookingClosedServices`; errors logged, not rethrown
- Test: `tests/service-booking-sync.test.ts`, extend `tests/api-booking-item.test.ts` mocks with `vi.mock("@/lib/service-booking-sync", ...)`

- [ ] **Step 1: Failing tests:** cancel cutoff (23 h ACCEPTED → 409); stranger cancel → 404; approve sets `visibleAt`; reject cancels silently (notifier not called — Review Focus 2); cancel after approval calls cancellation notifier; IN_PROGRESS request untouched by booking cancel; booking reject route calls `onBookingClosedServices("b1","REJECTED")`.
- [ ] **Step 2–4:** FAIL → implement → PASS (full `npm test` green). Commit `feat: requester cancel and booking/service sync`.

---

### Task 7: Notifications (bell + email)

**Files:**
- Create: `lib/service-notify.ts` — `notifyNewRequest(id)`, `notifyDecision(id)`, `notifyAssigned(id)`, `notifyCancelled(id)`; each loads recipients and calls email; never throws (catch + `console.error`)
- Modify: `lib/email.ts` — `sendServiceEmail(to: string[], subject: string, lines: string[], link: string)` using existing transporter/template style
- Modify: `lib/notifications.ts` — extend `NotificationType` with `"svc_new" | "svc_accepted" | "svc_rejected" | "svc_done" | "svc_assigned" | "svc_cancelled" | "svc_soon" | "svc_overdue"`; make booking fields optional and add `service?: { requestId: string; department: Dept; deptLabel: string; startTime: string; location: string; requesterName: string; reason?: string | null }`. Id: `${type}:${requestId}`.
- Create: `lib/service-notifications.ts` — `serviceNotifications(userId, memberships, now): Promise<NotificationItem[]>` deriving per spec table (30-day history, ≤40):
  - admins: `svc_new` at `visibleAt` (status PENDING), `svc_cancelled` at `cancelledAt` when `visibleAt` set, `svc_overdue` when IN_PROGRESS, has returnable item, `endTime < now`
  - assignee: `svc_assigned` at `assignedAt`, `svc_soon` when ACCEPTED/IN_PROGRESS and start within 24 h, `svc_cancelled`
  - requester: `svc_accepted|svc_rejected|svc_done` at `decidedAt`
- Modify: `app/api/notifications/route.ts` — merge, sort, slice; add `serviceCount` (pending `svc_new`) to response
- Modify: `app/components/NotificationBell.tsx` — render service items (icon `build` for AV, `cleaning_services` for HK, Thai labels), click → `/services/[dept]` for admin types, `/services/[dept]/assigned` for staff, `/services/mine` for requester types; no inline approve buttons for service items
- Test: `tests/service-notifications.test.ts`

- [ ] **Step 1: Failing tests:** admin gets `svc_new` only for visible PENDING; hidden request yields nothing; staff `svc_soon` within 24 h only; requester `svc_rejected` carries reason; overdue only with returnable item.
- [ ] **Step 2–4:** FAIL → implement → PASS. Manual check: bell shows service item in dev. Commit `feat: service request notifications`.

---

### Task 8: Catalog and membership admin APIs

**Files:**
- Create: `app/api/service-catalog/manage/route.ts` — GET `?dept=` all items (ADMIN of dept); POST `{ id?, department, name, returnable, active, sortOrder }` upsert
- Create: `app/api/admin/service-members/route.ts` — GET list with user `{id,name,email}`; POST `{ userId, department, role }` upsert; SYSTEM_ADMIN only
- Create: `app/api/admin/service-members/[id]/delete/route.ts` — POST remove
- Test: `tests/api-service-admin.test.ts`

- [ ] **Step 1: Failing tests:** non-admin → 403; HK admin managing AV catalog → 403; duplicate name → 409 `"มีรายการนี้อยู่แล้ว"`; ROOM_ADMIN on members → 403; SYSTEM_ADMIN upsert changes role.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: service catalog and member admin APIs`.

---

### Task 9: Request form UI

**Files:**
- Create: `app/components/ServiceRequestForm.tsx` — props `{ department: Dept; mode: "embedded" | "standalone"; value; onChange }`: catalog checkboxes + qty, "อื่น ๆ" rows (add/remove), phone (prefilled from `localStorage` key `svc-phone`), note, file input (accept `.pdf,image/*`, ≤5); in standalone also location/date/time. Shows lead-time hint `"ต้องขอล่วงหน้าอย่างน้อย 3 วัน"` and disables submit client-side when not met (server still enforces).
- Modify: `app/rooms/[id]/page.tsx` (~line 311 submit) — collapsible "ขอบริการเพิ่มเติม" with tabs แผนกโสต / กองอาคาร; after booking succeeds, POST one request per filled tab with `bookingId`; on a service failure keep the booking, show toast `"จองห้องสำเร็จ แต่ส่งคำร้อง${label}ไม่สำเร็จ: ${error}"` with link to booking detail.
- Create: `app/services/new/page.tsx` — standalone form; dept admins see `UserPicker` for on-behalf.
- Modify: `app/my-bookings/[id]/page.tsx` — service badges per dept (status label, "รอห้องอนุมัติ" when `waitingRoom`), cancel button when allowed, "ขอบริการเพิ่ม" opens form for depts not yet requested.
- Modify: `middleware.ts` matcher — add `"/services/:path*"`.

- [ ] **Step 1:** Implement. **Step 2:** `npx tsc --noEmit` and `npm run lint` clean. **Step 3:** Manual in dev (`npm run dev`): book a room with both tabs filled → two requests visible on booking detail as "รอห้องอนุมัติ"; standalone request 2 days ahead blocked. Commit `feat: service request form`.

---

### Task 10: Queues and admin pages

**Files:**
- Create: `app/services/mine/page.tsx` — my requests list with status badges + cancel
- Create: `app/services/[dept]/page.tsx` — admin queue: tabs รอรับงาน / รับงานแล้ว / กำลังดำเนินการ / เสร็จสิ้น / ปฏิเสธ / ยกเลิก (with counts), date filter, search by requester/room; row → detail drawer with items, attachments, booking link; actions: รับงาน (dialog: assignee from dept members, coordinator name/phone), ปฏิเสธ (reason), แก้ไข, เริ่มดำเนินการ, เสร็จสิ้น (returnedAt picker when needed); "สร้างคำร้อง" → `/services/new?dept=`
- Create: `app/services/[dept]/assigned/page.tsx` — staff view, tabs by status, progress/done actions
- Create: `app/services/[dept]/catalog/page.tsx` — list/add/edit/toggle items
- Create: `app/admin/service-members/page.tsx` — pick user (`UserPicker`), dept, role; list with remove
- Create: `app/api/me/route.ts` change — include `serviceMemberships` so header can show menus
- Modify: `app/components/AppHeader.tsx` NAV — "คำร้องบริการของฉัน" (authOnly); per membership "งาน${DEPT_LABEL}" (ADMIN → `/services/[dept]`, STAFF → `/services/[dept]/assigned`); "สมาชิกงานบริการ" for SYSTEM_ADMIN
- Dept param: URL uses lowercase `av` / `housekeeping`, mapped via `deptFromParam(s): Dept | null` in `lib/service-rules.ts` (404 on null)

- [ ] **Step 1:** Implement. **Step 2:** tsc + lint clean, `npm test` green. **Step 3:** Manual dev walk-through: SYSTEM_ADMIN adds AV admin + AV staff → approve the Task 9 booking → AV admin bell shows new request → accept + assign → staff bell shows assignment → staff progress → done with return date → requester bell shows done. Housekeeping admin cannot open `/services/av` (404/403). Commit `feat: service request queues and admin pages`.
