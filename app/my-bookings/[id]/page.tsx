"use client";

import { use } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { BookingDetailBody, useBookingDetail } from "@/app/components/BookingDetails";
import BookingServices from "@/app/components/BookingServices";
import { SkeletonCards } from "@/app/components/Skeleton";

// Standalone booking page (e.g. for links in emails/notifications).
// The room calendar shows the same content in a popup instead.
export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { booking, error, loading } = useBookingDetail(id);

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        title="รายละเอียดการจอง"
        breadcrumbs={[{ label: "การจองของฉัน", href: "/my-bookings" }, { label: "รายละเอียดการจอง" }]}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading || (!booking && !error) ? (
          <SkeletonCards count={1} />
        ) : error || !booking ? (
          <div className="empty-state">
            <span className="icon icon--40 text-ink-subtle" aria-hidden="true">event_busy</span>
            <p className="mb-2">{error}</p>
            <button type="button" className="btn-secondary" onClick={() => history.back()}>
              <span className="icon icon--20" aria-hidden="true">arrow_back</span>
              ย้อนกลับ
            </button>
          </div>
        ) : (
          <div className="card">
            <BookingDetailBody booking={booking} />
            <div className="flex flex-wrap gap-3 mt-4">
              <Link href={`/rooms/${booking.room.id}`} className="btn-secondary">
                <span className="icon icon--20" aria-hidden="true">calendar_month</span>
                ดูปฏิทินห้อง
              </Link>
              <Link href="/my-bookings" className="btn-secondary">
                <span className="icon icon--20" aria-hidden="true">list</span>
                การจองของฉัน
              </Link>
            </div>
          </div>
        )}
        {booking && (
          <BookingServices
            bookingId={booking.id}
            bookingStart={booking.startTime}
            canRequest={["PENDING", "APPROVED"].includes(booking.status) && new Date(booking.endTime) > new Date()}
          />
        )}
      </div>
    </div>
  );
}
