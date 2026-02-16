import Link from "next/link";
import Image from "next/image";
import InquiryBadge from "@/component/admin/InquiryBadge";
import VerificationBadge from "@/component/admin/VerificationBadge";

const PRIMARY = "#7553FC";

function DashboardCard({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-violet-400"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {title}
            {badge}
          </h3>
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
    <div className="mx-auto min-h-screen w-full px-16 py-5 space-y-2">
      <Link
        href="/home"
        className="flex items-center gap-3 hover:opacity-80 transition-opacity w-fit"
      >
        <div className="relative w-[52px] h-[52px]">
          <Image src="/LogoIcon.png" alt="CPX Mate" fill />
        </div>
        <div className="relative w-[120px] h-[18px]">
          <Image src="/LogoLetterIcon.png" alt="CPX Mate" fill />
        </div>
      </Link>
      <main className="flex w-full flex-col gap-10">

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
            description="학생의 실습 결과(전사/피드백/점수)를 확인합니다." />
          <DashboardCard
            href="/admin/dashboard/id-verifications"
            title="학생증 관리"
            description="학생증 인증 요청을 검토하고 승인/반려합니다."
            badge={<VerificationBadge />} />
        </Section>

        {/* 주호소별 관리 섹션 */}
        <Section title="주호소별 관리">
          <DashboardCard
            href="/admin/dashboard/checklist"
            title="체크리스트 관리"
            description="CSV 업로드로 케이스별 체크리스트를 등록/수정/삭제합니다." />
          <DashboardCard
            href="/admin/dashboard/prompt"
            title="프롬프트 관리"
            description="주호소별 Role Prompt와 해설 프롬프트를 관리합니다." />
        </Section>

        {/* 시나리오 섹션 */}
        <Section title="시나리오">
          <DashboardCard
            href="/admin/dashboard/scenario-gen"
            title="시나리오 관리"
            description="시나리오와 체크리스트를 생성하고 가상환자를 테스트합니다." />
        </Section>

        {/* 문의사항 섹션 */}
        <Section title="문의사항">
          <DashboardCard
            href="/admin/dashboard/inquiries"
            title="문의사항 관리"
            description="학생 문의에 답변하고, 답변 대기 건을 확인합니다."
            badge={<InquiryBadge />}
          />
        </Section>
      </main>
    </div>
  );
}
