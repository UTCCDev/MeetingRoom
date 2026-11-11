import type { Dept } from "@/lib/service-rules";

export type BookingNotificationType = "approval" | "approved" | "rejected" | "cancelled" | "reminder";
export type ServiceNotificationType =
  | "svc_new"
  | "svc_accepted"
  | "svc_rejected"
  | "svc_done"
  | "svc_assigned"
  | "svc_cancelled"
  | "svc_soon"
  | "svc_overdue";
export type NotificationType = BookingNotificationType | ServiceNotificationType;

export interface ServiceNotificationInfo {
  requestId: string;
  department: Dept;
  deptLabel: string;
  startTime: string;
  location: string;
  requesterName: string;
  reason?: string | null;
}

export interface NotificationItem {
  id: string; // `${type}:${bookingId|requestId}` — stable, so read state survives refetches
  type: NotificationType;
  at: string; // when it happened (ISO)
  // Booking fields (absent on service items — use isBookingItem to narrow).
  bookingId?: string;
  title?: string;
  roomId?: string;
  roomName?: string;
  roomDescription?: string | null;
  capacity?: number;
  startTime?: string;
  endTime?: string;
  attendees?: number;
  service?: ServiceNotificationInfo;
  requester?: { name: string; email: string };
  reason?: string | null;
  autoApproved?: boolean;
}

/** A booking-derived item: all booking fields are present. */
export type BookingNotificationItem = NotificationItem & {
  type: BookingNotificationType;
  bookingId: string;
  title: string;
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  capacity: number;
  startTime: string;
  endTime: string;
  attendees: number;
};

export type ServiceNotificationItem = NotificationItem & {
  type: ServiceNotificationType;
  service: ServiceNotificationInfo;
};

export const isServiceItem = (n: NotificationItem): n is ServiceNotificationItem => !!n.service;
export const isBookingItem = (n: NotificationItem): n is BookingNotificationItem => !n.service;

/** "เมื่อสักครู่", "5 นาทีที่แล้ว", "3 ชม.ที่แล้ว", "2 วันที่แล้ว" */
export function timeAgo(iso: string, now = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  return `${Math.floor(hr / 24)} วันที่แล้ว`;
}
