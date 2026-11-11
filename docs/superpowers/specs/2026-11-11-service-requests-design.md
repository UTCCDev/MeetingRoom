# Service Requests (โสต + แม่บ้าน) — Design

Replaces two legacy systems (AV equipment requests, housekeeping/กองอาคาร requests) that are being shut down. No data migration; feature parity is the goal.

## Departments and catalog

One request system, two departments (`AV` = แผนกโสต, `HOUSEKEEPING` = กองอาคาร). Catalog items are DB rows editable by that department's admins; each item has `returnable` (must be returned) and `active`.

Seed:
- AV: Laptop, Projector, LCD TV, Microphone (returnable); Manpower, โต๊ะเก้าอี้ (not returnable)
- HOUSEKEEPING: โพเดียม, โต๊ะจีน, เก้าอี้ใหญ่, เก้าอี้กลาง, รถไฟฟ้า (returnable); ช่างโยธา, แม่บ้าน (not returnable)
- Every request may also carry free-text "อื่น ๆ (ระบุ)" lines with a quantity.

## Roles (separate from booking roles)

`ServiceMember(userId, department, role: ADMIN | STAFF)`, one row per user per department. Managed by SYSTEM_ADMIN.

- Any signed-in user: create requests, view and cancel own requests.
- Department ADMIN: see all visible requests of the department, accept + assign staff + fill coordinator, change status, reject with reason, create a request on someone's behalf (bypasses 3-day rule), manage catalog.
- Department STAFF: see only requests assigned to them; move ACCEPTED → IN_PROGRESS → DONE.
- Nobody outside the department (including ROOM_ADMIN/SYSTEM_ADMIN) sees the department queue.

## Request

Fields: requester (user), contact phone (required), optional `bookingId`; when no booking: location, startTime, endTime (required). Items (catalog item or "other" text + qty ≥ 1, at least one). Note. Attachments (PDF/JPG/PNG/WebP, ≤5 MB each, ≤5 files). Admin-filled: coordinator name/phone, assignee, borrowedAt, returnedAt, internal note, rejection reason.

A booking may have at most one request per department.

## Lifecycle

```
PENDING → ACCEPTED → IN_PROGRESS → DONE
PENDING → REJECTED (reason required)
PENDING | ACCEPTED → CANCELLED
```
- Accept requires an assignee (STAFF or ADMIN of that department).
- IN_PROGRESS sets borrowedAt (admin can edit). DONE requires returnedAt if any item is returnable.

## Rules

- Lead time: usage start date ≥ today + 3 calendar days (Asia/Bangkok), same for both departments. Department admins creating requests are exempt.
- Requester cancel: PENDING any time before start; ACCEPTED only until 24 h before start. Otherwise "กรุณาติดต่อเจ้าหน้าที่".
- Visibility: a request tied to a booking is invisible to the department until the booking is APPROVED. Requester sees "รอห้องอนุมัติ".
- Booking REJECTED → its requests CANCELLED silently (department never saw them). Booking CANCELLED → requests CANCELLED; department notified if they had become visible.
- Request rejection never affects the booking.

## Notifications (bell + email)

Derived like booking notifications (no table), merged into `/api/notifications`:
- new visible request → department admins
- accepted / rejected / done → requester
- assigned → assignee
- cancelled (after visible) → department admins + assignee
- starts within 24 h → assignee
- returnable items, IN_PROGRESS, past endTime → department admins ("ยังไม่คืน")

Email for: new request, accepted/rejected, assigned, cancelled.

## Screens

- Booking form (room page): collapsible "ขอบริการเพิ่มเติม" with tabs โสต / แม่บ้าน.
- `/services/new`: standalone request (no booking).
- `/my-bookings/[id]`: service badges per department + "ขอบริการเพิ่ม".
- `/services/mine`: my requests.
- `/services/[dept]`: admin queue, tabs by status, date filter, create-on-behalf.
- `/services/[dept]/assigned`: staff queue.
- `/services/[dept]/catalog`: catalog management (dept admin).
- `/admin/service-members`: membership management (SYSTEM_ADMIN).

No reports or printing for now.
