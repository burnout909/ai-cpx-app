"use client";

import { Suspense } from "react";
import Link from "next/link";
import ScenarioListTable from "@/component/admin/ScenarioListTable";
import { useSearchParams } from "next/navigation";

function ScenarioListBody() {
  const params = useSearchParams();
  const chiefComplaint = params.get("chiefComplaint") ?? undefined;

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
          ← Admin Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">시나리오 관리</h1>
        <p className="text-sm text-gray-500">
          주호소별 시나리오를 생성하고 배포 상태를 관리합니다.
        </p>
      </header>
      <ScenarioListTable initialChiefComplaint={chiefComplaint} />
    </div>
  );
}

export default function AdminScenarioGenPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-8 px-8 py-8">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div>
              <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-64 bg-gray-100 rounded" />
            </div>
            <div className="animate-pulse">
              <div className="h-12 bg-gray-100 rounded mb-4" />
              <div className="h-64 bg-gray-100 rounded" />
            </div>
          </div>
        }
      >
        <ScenarioListBody />
      </Suspense>
    </main>
  );
}
