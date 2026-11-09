# Booking Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-user approval flags (auto-approve, president approver), president-only rooms, booking on behalf of another user with departments, and capacity-ascending room lists.

**Architecture:** All permission decisions live in pure functions in `lib/validation.ts`, unit-tested with vitest. API routes load the acting user's flags from the DB (`lib/actor.ts`) instead of trusting the JWT, call those functions, and share one post-approval side-effect function (`lib/booking-approval.ts`). One Prisma migration adds the new columns and flags the special rooms.

**Tech Stack:** Next.js 15 App Router, Prisma 3 (MySQL), next-auth JWT, zod, Tailwind; vitest (new, dev only).

**Spec:** `docs/superpowers/specs/2026-11-09-booking-permissions-design.md`

## Global Constraints

- **Never touch the production DB.** `.env` points at production. Dev uses local MySQL from `docker-compose.dev.yml` (port 3307) via `.env.development.local`; Prisma CLI only through `npm run db:dev:*`. Local copy has `rooms.calendarEmail` NULLed and `EMAIL_*` blank so dev never writes room calendars or emails real users. Production migration is done later by the user: backup → `prisma migrate deploy`.

- UI text and API error messages are Thai, matching existing tone.
- Production blocks PUT/DELETE: every new PUT/DELETE route gets a POST alias route like `app/api/bookings/[id]/decide/route.ts`.
- Never return the password hash: user includes use `{ select: { id, name, email } }` (+ department name where needed).
- Booking times: existing `bangkokDate` parsing; overlap check unchanged (strict `lt`/`gt`, PENDING+APPROVED).
- Graph and email failures are logged, never undo a DB change.
- `isPresidentApprover` only on ROOM_ADMIN / SYSTEM_ADMIN; demoting to USER clears it.
- `autoApproveBooking` allowed on any role.
- President rooms: AUTO only when the **booker** has both `autoApproveBooking` and `isPresidentApprover`; beneficiary flags never count there.

## Review Focus

1. Booking for oneself while also choosing oneself as beneficiary → treat `bookedForId === userId` as null (no duplicate emails/notifications).
2. Beneficiary deactivated after booking → booking still visible to booker; beneficiary lookup must not crash (`bookedFor` nullable include).
3. Role demoted from ROOM_ADMIN to USER with `isPresidentApprover=true` → flag cleared in the same update.
4. Two approvers deciding the same PENDING booking → existing `updateMany where status PENDING` guard keeps working with new fields.
5. Migration on rows whose `code` is NULL → regexp update must skip them, not fail.

Tests for 1, 3, 4, 5 are pinned in Tasks 1, 4, 7, 2 respectively; 2 in Task 6.

---

### Task 1: vitest + permission rules

**Files:**
- Create: `vitest.config.ts`, `tests/booking-rules.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`), `lib/validation.ts`

**Interfaces:**
- Produces (in `lib/validation.ts`):
  - `type Actor = { id: string; role: "USER" | "ROOM_ADMIN" | "SYSTEM_ADMIN"; isPresidentApprover: boolean; autoApproveBooking: boolean }`
  - `type RoomRule = { roomAdminId: string; requiresPresidentApproval: boolean }`
  - `approvalRoute(booker: Actor, beneficiary: Actor | null, room: RoomRule): "AUTO" | "ROOM_ADMIN" | "PRESIDENT"`
  - `canDecide(user: Actor, room: RoomRule): boolean` (replaces old signature)
  - `canView(user: Actor, booking: { userId: string; bookedForId: string | null; room: RoomRule }): boolean`
  - `canCancel(userId: string, booking: { userId: string; bookedForId: string | null }): boolean`
  - `normalizeBeneficiary(bookerId: string, bookedForId?: string | null): string | null` (self → null)
  - `presidentFlagFor(role: Actor["role"], requested: boolean | undefined, current: boolean): boolean` (USER → false always)

- [ ] **Step 1: Add vitest.** `npm i -D vitest`; `vitest.config.ts` with `resolve.alias { "@": path.resolve(__dirname) }`, `test.environment: "node"`.
- [ ] **Step 2: Write failing tests** in `tests/booking-rules.test.ts`:
  - approvalRoute normal room: plain USER → `ROOM_ADMIN`; SYSTEM_ADMIN without flag → `ROOM_ADMIN`; booker `autoApproveBooking` → `AUTO`; beneficiary `autoApproveBooking` only → `AUTO`.
  - approvalRoute president room: booker auto only → `PRESIDENT`; booker president-approver only → `PRESIDENT`; booker both → `AUTO`; beneficiary both, booker none → `PRESIDENT`; SYSTEM_ADMIN with auto only → `PRESIDENT`.
  - canDecide: SYSTEM_ADMIN normal room true; ROOM_ADMIN own room true, other room false; USER false; SYSTEM_ADMIN president room false; ROOM_ADMIN+president flag president room true.
  - canView: booker, beneficiary, deciding admin true; stranger false. canCancel: booker and beneficiary true, admin false.
  - normalizeBeneficiary(`"u1"`, `"u1"`) → null; (`"u1"`, `"u2"`) → `"u2"`; (`"u1"`, undefined) → null.
  - presidentFlagFor(`"USER"`, true, false) → false; (`"ROOM_ADMIN"`, undefined, true) → true; (`"USER"`, undefined, true) → false.
- [ ] **Step 3:** `npm test` → FAIL (functions missing).
- [ ] **Step 4:** Implement in `lib/validation.ts`; remove old `canDecide`/`canView` signatures. Keep `canTransition`.
- [ ] **Step 5:** `npm test` → PASS. Commit `feat: add booking permission rules with tests`.

### Task 2: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261109000000_booking_permissions/migration.sql`

**Interfaces:**
- Produces: `Department { id String @id @default(cuid()); name String @unique; users User[]; @@map("departments") }`; `User.departmentId String?`, `User.department Department?`, `User.isPresidentApprover Boolean @default(false)`, `User.autoApproveBooking Boolean @default(false)`; `Room.requiresPresidentApproval Boolean @default(false)`; `Booking.bookedForId String?` (relation `"BookedFor"`, onDelete SetNull), `Booking.approvedById String?` (relation `"ApprovedBy"`, onDelete SetNull), `Booking.autoApproved Boolean @default(false)`, `Booking.decisionNote String? @db.Text`. Existing `User.bookings` relation gets name `"BookedBy"`.

- [ ] **Step 1:** Edit schema; run `npm run db:dev:migrate -- --create-only --name booking_permissions`, rename folder to the path above. Never run bare `npx prisma migrate` (reads `.env` = production).
- [ ] **Step 2:** Append to migration.sql:
  ```sql
  UPDATE `rooms` SET `requiresPresidentApproval` = true
  WHERE `name` LIKE '%ไทรทอง%'
     OR (`code` IS NOT NULL AND `code` REGEXP '^[MES]2408[0-9]{2}$');
  ```
- [ ] **Step 3:** `npm run db:dev:migrate` on the local DB (loaded from the prod dump) → applies cleanly; `SELECT code,name FROM rooms WHERE requiresPresidentApproval` lists ไทรทอง and every 24-08 room, no error on NULL-code rows. `npx prisma generate`; `npx tsc --noEmit` shows only errors from callers of the old `canDecide`/`canView` (fixed in Tasks 3–7).
- [ ] **Step 4:** Commit `feat: schema for departments, approval flags, booking on behalf`.

### Task 3: Actor loader + shared approval follow-up

**Files:**
- Create: `lib/actor.ts`, `lib/booking-approval.ts`, `tests/booking-approval.test.ts`
- Modify: `lib/email.ts` (accept `string | string[]` recipients in `sendBookingNotification`)

**Interfaces:**
- Produces: `loadActor(session): Promise<Actor | null>` (reads user by `session.user.id`, null if missing or inactive).
- Produces: `onBookingApproved(bookingId: string): Promise<void>` — loads booking with room, user, bookedFor; if `room.calendarEmail && isRoomCalendarConfigured()` creates the Graph event and saves `graphEventId`; emails booker + beneficiary (deduped) with status `APPROVED`. Catches and logs every failure.

- [ ] **Step 1: Failing test** (mock `@/lib/prisma`, `@/lib/room-calendar`, `@/lib/email`): `onBookingApproved` emails `["a@utcc.ac.th","b@utcc.ac.th"]` when beneficiary differs; one address when `bookedForId` null; createRoomEvent rejection → resolves without throwing and still emails.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement both files, move the Graph block out of `app/api/bookings/[id]/route.ts` PUT.
- [ ] **Step 4:** `npm test` → PASS. Commit `refactor: shared approval follow-up and DB-backed actor`.

### Task 4: Create booking (routing + on behalf)

**Files:**
- Modify: `lib/validation.ts` (`createBookingSchema` + `bookedForId: z.string().optional().nullable()`), `app/api/bookings/route.ts`
- Test: `tests/api-bookings-create.test.ts`

**Interfaces:**
- Consumes: `loadActor`, `approvalRoute`, `normalizeBeneficiary`, `onBookingApproved`.

- [ ] **Step 1: Failing tests** (mock prisma/session): plain USER → 201 `status: "PENDING"`, approval email sent to room admin; booker with auto flag normal room → `APPROVED`, `autoApproved: true`, `approvedById` = booker, `onBookingApproved` called; beneficiary with auto flag → `APPROVED`; booker with both flags, president room → `APPROVED`; booker auto only, president room → `PENDING`; overlap with auto flag → 409; unknown or inactive `bookedForId` → 400 `field: "bookedForId"`; `bookedForId` equal to self → stored null.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. For `PRESIDENT` route, `sendApprovalRequest` goes to every active user with `isPresidentApprover` instead of the room admin. GET returns bookings where `userId = me OR bookedForId = me`, including `bookedFor` (id, name, email).
- [ ] **Step 4:** PASS. Commit `feat: approval routing and booking on behalf`.

### Task 5: User search API + booking form field

**Files:**
- Create: `app/api/users/search/route.ts`, `app/components/UserPicker.tsx`
- Modify: `app/rooms/[id]/page.tsx` (booking form)

**Interfaces:**
- Produces: `GET /api/users/search?q=` → `{ id, name, email, department: string | null }[]`, max 10, active users, `q` ≥ 2 chars matched on name/email `contains`; 401 when signed out.
- Produces: `<UserPicker value={user|null} onChange={(u) => void} />`, default shows "ตัวฉันเอง".

- [ ] **Step 1:** Implement route; form sends `bookedForId` (omitted when self). Label "จองเพื่อ".
- [ ] **Step 2:** Manual: `npm run dev`, search by Thai name and email, book for another department's user → appears in both users' "การจองของฉัน".
- [ ] **Step 3:** Commit `feat: book on behalf of another user`.

### Task 6: View, cancel, my-bookings, notifications for beneficiary

**Files:**
- Modify: `app/api/bookings/[id]/route.ts` (GET, DELETE), `app/api/notifications/route.ts`, `app/my-bookings/page.tsx`, `app/components/BookingProgress.tsx`
- Test: `tests/api-bookings-cancel.test.ts`

- [ ] **Step 1: Failing tests:** beneficiary GET → 200; beneficiary DELETE → cancelled; room admin DELETE → 403; GET for booking whose `bookedFor` was deleted (null) → 200.
- [ ] **Step 2:** FAIL → implement with `canView`/`canCancel` → PASS.
- [ ] **Step 3:** Notifications: owner-side query uses `OR: [{ userId: me }, { bookedForId: me }]`; approval-side scope from `canDecide` (president rooms → users with `isPresidentApprover`; normal → existing role scope); drop `userId: { not: me }` from the approval query (self-approval is allowed). Item gets `autoApproved` and shows "อนุมัติอัตโนมัติ" text.
- [ ] **Step 4:** UI: my-bookings shows "จองโดย X" / "จองเพื่อ Y"; BookingProgress shows "อนุมัติแล้ว ✓ (อนุมัติอัตโนมัติตามสิทธิ์ผู้จอง)" when `autoApproved`. Commit `feat: beneficiary can view, cancel and get notified`.

### Task 7: Decide booking (approve/reject)

**Files:**
- Modify: `app/api/bookings/[id]/route.ts` (PUT), `app/api/admin/pending-bookings/route.ts`, `app/admin/pending-approvals/page.tsx`, `app/components/AppHeader.tsx`
- Test: `tests/api-bookings-decide.test.ts`

- [ ] **Step 1: Failing tests:** SYSTEM_ADMIN on president room → 403; president approver approves → 200 with `approvedById`, `decisionNote` saved; approver approving own request → 200 (self-rule removed); second concurrent decide (updateMany count 0) → 409.
- [ ] **Step 2:** FAIL → implement: remove the "own request" 403, set `approvedById`, accept optional `decisionNote` (≤500), call `onBookingApproved` on APPROVED; reject email to booker + beneficiary → PASS.
- [ ] **Step 3:** pending-bookings: SYSTEM_ADMIN → normal rooms; ROOM_ADMIN → own normal rooms; plus president rooms when `isPresidentApprover`. Page shows booker, beneficiary + department, badge "ห้องพิเศษ (อธิการฯ)", "อนุมัติคำขอของตนเอง" when booker = me, note textarea.
- [ ] **Step 4:** Commit `feat: president approval and self-approval`.

### Task 8: Admin settings (departments, user flags, room flag)

**Files:**
- Create: `app/api/admin/departments/route.ts` (GET, POST, PUT, DELETE) + POST aliases `app/api/admin/departments/update/route.ts`, `.../delete/route.ts`; `app/admin/departments/page.tsx`
- Modify: `app/api/admin/users/route.ts`, `app/admin/users/page.tsx`, room create/update routes + room form, `app/components/AppHeader.tsx` (nav "แผนก", SYSTEM_ADMIN)
- Test: `tests/api-admin-users.test.ts`

- [ ] **Step 1: Failing tests:** PUT user USER + `isPresidentApprover: true` → 400; demote ROOM_ADMIN (flag true) to USER → saved flag false (uses `presidentFlagFor`); `autoApproveBooking` on USER → saved; DELETE department in use → 409 "มีผู้ใช้ในแผนกนี้".
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** UI: users table gets department select and two checkboxes ("อนุมัติแทนอธิการฯ" disabled for USER, "จองแล้วอนุมัติทันที"); room form gets "ต้องให้อธิการฯ อนุมัติ". Commit `feat: admin settings for approval flags and departments`.

### Task 9: Capacity sort

**Files:**
- Modify: `app/api/rooms/route.ts:37`, `app/rooms/page.tsx`, `app/components/QuickSearch.tsx` (if it sorts)

- [ ] **Step 1:** `orderBy: [{ capacity: "asc" }, { code: "asc" }]`; remove any client re-sort that breaks it.
- [ ] **Step 2:** Manual: /rooms and quick search list capacities non-decreasing with any filter.
- [ ] **Step 3:** Commit `feat: sort rooms by capacity ascending`.

### Final check

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` all pass.
- [ ] Manual walk-through of the spec's permission table on dev data, one booking per row.
