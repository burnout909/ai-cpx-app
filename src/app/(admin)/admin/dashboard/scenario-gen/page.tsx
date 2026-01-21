"use client";

import { Suspense } from "react";
import Header from "@/component/Header";
import { ScenarioDashboardClient } from "@/component/dashboard/ScenarioDashboardClient";
import { useSearchParams } from "next/navigation";

function ScenarioGenBody() {
  const params = useSearchParams();
  const category = params.get("category") ?? "";
  const caseName = params.get("case") ?? "";

  return (
    <main className="flex-1 px-6 pt-4 pb-10 space-y-4">
      <ScenarioDashboardClient
        initialCategory={category}
        initialCaseName={caseName}
      />
    </main>
  );
}

export default function AdminScenarioGenPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <Suspense fallback={<main className="flex-1 px-6 pt-4 pb-10" />}>
        <ScenarioGenBody />
      </Suspense>
    </div>
  );
}
