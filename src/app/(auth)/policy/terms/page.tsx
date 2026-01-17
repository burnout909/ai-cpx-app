export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
      <div className="w-full max-w-[720px] rounded-2xl bg-white p-8">
        <h1 className="text-[22px] font-semibold text-[#210535]">이용약관</h1>
        <p className="text-sm text-gray-600 mt-2">
          본 약관은 CPXMate 서비스(https://expo-cpx-mate.vercel.app)의 이용에 관한
          기본 사항을 규정합니다.
        </p>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            1. 서비스 제공
          </h2>
          <p>본 서비스는 회원가입 및 로그인, 학생증 인증을 포함합니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            2. 회원 계정
          </h2>
          <p>이용자는 정확한 정보를 제공해야 하며, 계정의 관리 책임은 이용자에게 있습니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            3. 이용자의 의무
          </h2>
          <p>관련 법령 및 본 약관을 준수해야 합니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            4. 서비스 이용 제한
          </h2>
          <p>서비스의 정상적인 운영을 방해하는 경우 이용을 제한할 수 있습니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            5. 약관 변경
          </h2>
          <p>약관 변경 시 서비스 내 공지 또는 기타 방법으로 안내합니다.</p>
        </section>

        <section className="mt-6 text-xs text-gray-500">
          시행일: 2025-01-01
        </section>
      </div>
    </main>
  );
}
