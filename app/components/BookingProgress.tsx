import { formatDate } from "@/lib/format";

type StepState = "done" | "current" | "upcoming" | "error" | "stopped";

interface Step {
  label: string;
  caption?: string;
  state: StepState;
  icon: string; // Material Symbols name shown when not "done"
}

/**
 * Where a booking is in its lifecycle:
 * ส่งคำขอ → ผู้ดูแลพิจารณา → พร้อมใช้ห้อง → ประชุม
 * Rejected / cancelled / never-approved bookings stop at the step where they ended.
 */
function bookingSteps(
  b: { status: string; startTime: string; endTime: string; createdAt?: string },
  now: Date
): Step[] {
  const start = new Date(b.startTime);
  const end = new Date(b.endTime);
  const started = start <= now;
  const finished = end <= now;

  const submitted: Step = {
    label: "ส่งคำขอ",
    caption: b.createdAt ? formatDate(b.createdAt) : undefined,
    state: "done",
    icon: "send",
  };
  const review: Step = { label: "ผู้ดูแลพิจารณา", state: "upcoming", icon: "hourglass_top" };
  const ready: Step = { label: "พร้อมใช้ห้อง", state: "upcoming", icon: "event_available" };
  const meeting: Step = { label: "ประชุม", state: "upcoming", icon: "groups" };

  switch (b.status) {
    case "PENDING":
      if (started) {
        review.state = "stopped";
        review.label = "ไม่ได้รับการพิจารณา";
        review.caption = "เลยเวลาประชุมแล้ว";
        review.icon = "timer_off";
      } else {
        review.state = "current";
        review.caption = "รอผู้ดูแลห้องอนุมัติ";
      }
      break;
    case "APPROVED":
      review.state = "done";
      review.caption = "อนุมัติแล้ว";
      if (finished) {
        ready.state = "done";
        meeting.state = "done";
        meeting.caption = "เสร็จสิ้น";
      } else if (started) {
        ready.state = "done";
        meeting.state = "current";
        meeting.caption = "กำลังประชุม";
      } else {
        ready.state = "current";
        ready.caption = "เข้าใช้ห้องได้ตามเวลา";
      }
      break;
    case "REJECTED":
      review.state = "error";
      review.label = "ถูกปฏิเสธ";
      review.icon = "close";
      break;
    case "CANCELLED":
      review.state = "stopped";
      review.label = "ยกเลิกแล้ว";
      review.icon = "block";
      break;
  }

  return [submitted, review, ready, meeting];
}

const STATE_TEXT: Record<StepState, string> = {
  done: "เสร็จแล้ว",
  current: "ขั้นตอนปัจจุบัน",
  upcoming: "ยังไม่ถึง",
  error: "ไม่ผ่าน",
  stopped: "สิ้นสุด",
};

const MARKER: Record<StepState, string> = {
  done: "bg-primary text-on-primary",
  current: "bg-surface text-primary ring-2 ring-primary ring-offset-2",
  upcoming: "bg-surface text-disabled-fg border border-outline",
  error: "bg-error text-on-error",
  stopped: "bg-disabled-bg text-ink-subtle",
};

const LABEL: Record<StepState, string> = {
  done: "text-ink",
  current: "text-primary",
  upcoming: "text-ink-subtle font-normal",
  error: "text-error",
  stopped: "text-ink-muted",
};

export default function BookingProgress({
  booking,
  now,
}: {
  booking: { status: string; startTime: string; endTime: string; createdAt?: string };
  now: Date;
}) {
  const steps = bookingSteps(booking, now);

  return (
    <ol className="grid grid-cols-4" aria-label="ขั้นตอนการจอง">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        // Connector is "filled" once the next step has been reached.
        const connectorDone = next && (next.state === "done" || next.state === "current");
        return (
          <li
            key={i}
            className="relative flex flex-col items-center text-center px-1"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {next && (
              <span
                className={`absolute top-4 left-1/2 w-full h-0.5 ${connectorDone ? "bg-primary" : "bg-line"}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 inline-flex items-center justify-center w-8 h-8 rounded-full ${MARKER[step.state]}`}
              aria-hidden="true"
            >
              <span className={`icon icon--20 ${step.state === "current" ? "icon--w600" : "icon--w500"}`}>
                {step.state === "done" ? "check" : step.icon}
              </span>
            </span>
            <span className={`mt-2 text-label-large ${LABEL[step.state]}`}>
              {step.label}
              <span className="sr-only"> ({STATE_TEXT[step.state]})</span>
            </span>
            {step.caption && (
              <span className="text-body-small text-ink-subtle">{step.caption}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
