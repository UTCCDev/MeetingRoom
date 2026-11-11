"use client";

import DeptPage from "@/app/components/DeptPage";
import CatalogManager from "@/app/components/CatalogManager";

export default function CatalogPage({ params }: { params: Promise<{ dept: string }> }) {
  return (
    <DeptPage params={params} need="ADMIN" title={(l) => `รายการอุปกรณ์${l}`} suffix="รายการอุปกรณ์">
      {(dept) => <CatalogManager dept={dept} />}
    </DeptPage>
  );
}
