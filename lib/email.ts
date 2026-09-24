import nodemailer from "nodemailer";
import { formatDate, formatTime } from "@/lib/format";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendBookingNotification = async (
  to: string,
  bookingTitle: string,
  status: "APPROVED" | "REJECTED",
  roomName: string,
  startTime: Date,
  rejectionReason?: string
) => {
  const subject =
    status === "APPROVED"
      ? `การจองห้องประชุมของคุณได้รับการอนุมัติ`
      : `การจองห้องประชุมของคุณถูกปฏิเสธ`;

  const message = `
    <h2>${subject}</h2>
    <p>สถานะการจอง: <strong>${status === "APPROVED" ? "อนุมัติแล้ว" : "ปฏิเสธ"}</strong></p>
    <p>ห้องประชุม: ${escapeHtml(roomName)}</p>
    <p>หัวข้อการประชุม: ${escapeHtml(bookingTitle)}</p>
    <p>เวลาเริ่มต้น: ${formatDate(startTime)} ${formatTime(startTime)} น.</p>
    ${rejectionReason ? `<p>เหตุผลการปฏิเสธ: ${escapeHtml(rejectionReason)}</p>` : ""}
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: message,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

/** Tells a room admin a new request is waiting, with a button to the approval page. */
export const sendApprovalRequest = async (
  to: string,
  booking: { title: string; attendees: number; startTime: Date; endTime: Date },
  roomName: string,
  requesterName: string
) => {
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const link = `${base}/admin/pending-approvals`;
  const subject = `คำขอจองห้อง ${roomName} รอการอนุมัติ`;

  const message = `
    <h2>มีคำขอจองห้องประชุมรอการอนุมัติ</h2>
    <p>ผู้ขอ: <strong>${escapeHtml(requesterName)}</strong></p>
    <p>ห้องประชุม: ${escapeHtml(roomName)}</p>
    <p>หัวข้อการประชุม: ${escapeHtml(booking.title)}</p>
    <p>เวลา: ${formatDate(booking.startTime)} ${formatTime(booking.startTime)}–${formatTime(booking.endTime)} น.</p>
    <p>จำนวนผู้เข้าร่วม: ${booking.attendees} คน</p>
    <p style="margin-top:24px">
      <a href="${link}" style="background:#2E3192;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;display:inline-block">
        ตรวจสอบและอนุมัติ
      </a>
    </p>
  `;

  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html: message });
};
