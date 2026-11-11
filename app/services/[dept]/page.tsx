"use client";

import DeptPage from "@/app/components/DeptPage";
import ServiceQueue from "@/app/components/ServiceQueue";

export default function DeptQueuePage({ params }: { params: Promise<{ dept: string }> }) {
  return (
    <DeptPage params={params} need="ADMIN" title={(l) => `คิวคำร้อง${l}`}>
      {(dept) => <ServiceQueue dept={dept} mode="admin" />}
    </DeptPage>
  );
}
