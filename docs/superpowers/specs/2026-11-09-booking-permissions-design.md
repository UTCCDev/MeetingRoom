# Booking permissions, president approval, booking on behalf, capacity sort

Date: 2026-11-09 · Status: draft for review

## Source feedback

1. Level 1 (highest): booking needs no approval. Level 2 (room admin): approves requests. Level 3 (user): booking waits for approval.
2. Exception: ห้องไทรทอง and every room in building 24 floor 8 always need the president's (อธิการฯ) approval, for every user level.
3. A booking can be made for someone else, including someone in another department.
4. Room search results are always sorted by capacity, smallest first.

## Decisions

| Feedback level | Existing role | Booking result |
|---|---|---|
| Level 1 | SYSTEM_ADMIN | Waits for approval like everyone else, but can approve any normal-room request, including their own |
| Level 2 | ROOM_ADMIN | Waits for approval like everyone else; in rooms they administer they approve their own request |
| Level 3 | USER | Waits for the room admin |

- No new role. President approval is a separate capability: `User.isPresidentApprover` (boolean). It is held by the president or by staff who approve on the president's behalf (e.g. the president's secretary), and only by ROOM_ADMIN or SYSTEM_ADMIN (a USER approves nothing). The flag is only settable for those roles, and demoting a user to USER clears it. A secretary can therefore be a ROOM_ADMIN of their own rooms **and** a president approver.
- Rooms that need president approval are flagged per room (`Room.requiresPresidentApproval`), not hard-coded by name.
- Whoever *makes* the booking decides the approval route, not the person it is booked for.

## Approval routing

Single function `approvalRoute(user, room)` in `lib/validation.ts` `approvalRoute(booker, beneficiary, room)` returns `"AUTO" | "ROOM_ADMIN" | "PRESIDENT"`:

1. `room.requiresPresidentApproval`:
   - booker (not beneficiary) has **both** `autoApproveBooking` and `isPresidentApprover` → `AUTO`;
   - otherwise → `PRESIDENT`.
   Self-clicking adds no real control (maker = checker), so a booker who could approve anyway is auto-approved; this mirrors Exchange room resources, where BookInPolicy users are auto-accepted even on delegate-managed rooms. Only the booker's flags count, so nobody can book in the president's name to skip approval.
2. Else `booker.autoApproveBooking || beneficiary.autoApproveBooking` → `AUTO`.
3. Else → `ROOM_ADMIN`.

Roles never auto-approve by themselves. A SYSTEM_ADMIN or ROOM_ADMIN without the flag creates a PENDING request and approves it in one click; this deliberately overrides the feedback's "Level 1 needs no approval" so every user sees the same steps.

**Auto-approve tier:** `User.autoApproveBooking` (UI: "จองแล้วอนุมัติทันที") is set by SYSTEM_ADMIN on any role, including USER (e.g. deans, executives). It applies when either the booker or the beneficiary has it, so a secretary booking for an executive gets the executive's tier. `Booking.userId` records who actually booked, for audit.

AUTO bookings still pass the overlap check, are created `APPROVED` with `approvedById = booker` and `autoApproved = true`, and run the same follow-up as a manual approval (Graph room-calendar event + emails). That follow-up moves out of `PUT /api/bookings/[id]` into a shared `onBookingApproved(bookingId)` in `lib/booking-approval.ts`. The booking progress UI still shows every step: "ส่งคำขอ ✓ → อนุมัติแล้ว ✓ (อนุมัติอัตโนมัติตามสิทธิ์ผู้จอง)".

`canDecide(user, room)`:
- Normal room: SYSTEM_ADMIN or `room.roomAdminId === user.id`.
- President room: `user.isPresidentApprover` only. SYSTEM_ADMIN cannot approve these.

Self-approval: the old rule "nobody decides their own request" is removed. An approver may approve a request they made (e.g. a room admin booking their own room, or the president's secretary booking ไทรทอง for the president). `approvedById` records who approved, so a self-approval is visible in the audit trail. The approval screen labels it "อนุมัติคำขอของตนเอง".

Approval sets `approvedById` and keeps today's follow-up (Graph room-calendar event + approval email, sent to booker and beneficiary).

## Schema changes (one new migration)

- `Department { id, name @unique }`, managed by SYSTEM_ADMIN.
- `User.departmentId String?` → Department; `User.isPresidentApprover Boolean @default(false)`; `User.autoApproveBooking Boolean @default(false)`.
- `Room.requiresPresidentApproval Boolean @default(false)`. The migration sets it to true where `name LIKE '%ไทรทอง%'` or the room code is building 24, floor 08 (`code REGEXP '^[MES]2408[0-9]{2}$'`). It can be edited in the room form afterwards.
- `Booking.bookedForId String?` → User (null = booked for self), `Booking.approvedById String?` → User, `Booking.autoApproved Boolean @default(false)`, `Booking.decisionNote String?` (e.g. "อนุมัติแทนอธิการฯ ตามบันทึกที่ ...").
- `Booking.userId` keeps meaning "who made the booking".

## Booking on behalf

- Booking form gets a "จองเพื่อ" field, default = self, with a user search (name or email) backed by new `GET /api/users/search?q=` (signed-in users only; returns id, name, email, department name; max 10 results; active users only).
- Any department may be chosen.
- Booker and beneficiary both: see the booking in "การจองของฉัน", receive emails and in-app notifications, and may cancel it.
- `canView` adds the beneficiary.
- Approval screens show booker, beneficiary and beneficiary's department.

## Other changes

- `/api/rooms` and the rooms page: `orderBy: [{ capacity: "asc" }, { code: "asc" }]`; client-side filtering keeps that order.
- admin/users: set department, the president-approver flag and the auto-approve flag.
- New admin page for departments (list, add, rename; delete only when unused).
- Room form: "ต้องให้อธิการฯ อนุมัติ" checkbox.
- admin/pending-approvals and `/api/admin/pending-bookings`: list what `canDecide` allows. President approvers see president-room requests; an optional note is saved to `decisionNote`.
- `/api/notifications`: "approval" items use the new `canDecide` scope. Owner-side items also go to the beneficiary.

## Error handling

- AUTO booking with Graph or email failure: booking stays APPROVED; the failure is logged (same as today).
- `bookedForId` unknown or inactive user → 400 with `field: "bookedForId"`.
- A non-approver deciding a president room → 403.
- Setting `isPresidentApprover` on a USER → 400; changing a role to USER clears the flag.

## Testing

- Add vitest (the repo has no tests yet).
- Unit: `approvalRoute` and `canDecide`, every cell of the routing table, plus SYSTEM_ADMIN denied on president rooms.
- API (Prisma mocked): bookings without the auto-approve flag are created PENDING for every role; flagged booker or beneficiary in a normal room → APPROVED + follow-up called; flagged user in a president room → PENDING; booker with both flags in a president room → APPROVED; beneficiary with both flags (booker without) in a president room → PENDING; AUTO booking with conflict → 409; approver approves own request → APPROVED with `approvedById`; booking for another user → both can view and cancel; president approver approves; SYSTEM_ADMIN rejected on a president room.
- Manual: capacity sort on /rooms; migration flags the right rooms on the real data.

## Out of scope

- Requisition (ใบเบิก) or billing features.
- Free-text beneficiaries who have no account.
