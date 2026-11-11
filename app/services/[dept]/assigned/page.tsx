"use client";

import DeptPage from "@/app/components/DeptPage";
import ServiceQueue from "@/app/components/ServiceQueue";

export default function AssignedPage({ params }: { params: Promise<{ dept: string }> }) {
  return (
    <DeptPage params={params} need="MEMBER" title={(l) => `งานที่ได้รับมอบหมาย${l}`} suffix="งานของฉัน">
      {(dept) => <ServiceQueue dept={dept} mode="staff" />}
    </DeptPage>
  );
}
