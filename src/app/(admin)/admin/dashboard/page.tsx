import Link from "next/link";

const PRIMARY = "#7553FC";

function DashboardCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-violet-400"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mt-2 text-sm text-gray-500">{description}</p>
        </div>
        <span className="text-sm font-semibold" style={{ color: PRIMARY }}>→</span>
      </div>
    </Link>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-[#7553FC] pl-3">
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default function AdminDashboardLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-10 px-16 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-base text-gray-500">
          아래에서 필요한 관리 기능을 선택하세요.
        </p>
      </header>

      {/* 학생 섹션 */}
      <Section title="학생">
        <DashboardCard
          href="/admin/dashboard/student"
          title="학번 조회를 통한 학생 조회"
          description="학생의 실습 결과(전사/피드백/점수)를 확인합니다."
        />
        <DashboardCard
          href="/admin/dashboard/id-verifications"
          title="학생증 관리"
          description="학생증 인증 요청을 검토하고 승인/반려합니다."
        />
      </Section>

      {/* 체크리스트 섹션 */}
      <Section title="체크리스트">
        <DashboardCard
          href="/admin/dashboard/checklist"
          title="체크리스트 관리"
          description="CSV 업로드로 케이스별 체크리스트를 등록/수정/삭제합니다."
        />
      </Section>

      {/* 시나리오 섹션 */}
      <Section title="시나리오">
        <DashboardCard
          href="/admin/dashboard/scenario-gen"
          title="시나리오 관리"
          description="시나리오와 체크리스트를 생성하고 가상환자를 테스트합니다."
        />
      </Section>
    </main>
  );
}
