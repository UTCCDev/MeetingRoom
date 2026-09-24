export type NotificationType = "approval" | "approved" | "rejected" | "cancelled" | "reminder";

export interface NotificationItem {
  id: string; // `${type}:${bookingId}` — stable, so read state survives refetches
  type: NotificationType;
  at: string; // when it happened (ISO)
  bookingId: string;
  title: string;
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  capacity: number;
  startTime: string;
  endTime: string;
  attendees: number;
  requester?: { name: string; email: string };
  reason?: string | null;
}

/** "เมื่อสักครู่", "5 นาทีที่แล้ว", "3 ชม.ที่แล้ว", "2 วันที่แล้ว" */
export function timeAgo(iso: string, now = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  return `${Math.floor(hr / 24)} วันที่แล้ว`;
}
