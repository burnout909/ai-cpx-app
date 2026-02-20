import PageTracker from "@/component/PageTracker";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
      <PageTracker page="privacy_policy" />
      <div className="w-full max-w-[720px] rounded-2xl bg-white p-8">
        <h1 className="text-[22px] font-semibold text-[#210535]">
          개인정보처리방침
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          CPXMate(https://expo-cpx-mate.vercel.app)는 「개인정보 보호법」 등 관련
          법령을 준수하며, 아래와 같이 개인정보를 처리합니다.
        </p>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            1. 개인정보의 처리 목적
          </h2>
          <p>
            회원가입, 로그인, 학생증 인증 및 서비스 운영을 위한 사용자 식별에
            개인정보를 이용합니다.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            2. 수집하는 개인정보 항목
          </h2>
          <p>
            필수: 이름, 나이, 학번, 이메일(로그인 계정)
          </p>
          <p>선택: 없음</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            3. 개인정보의 처리 및 보유 기간
          </h2>
          <p>회원 탈퇴 시까지 보유 및 이용합니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            4. 개인정보의 제3자 제공 및 처리 위탁
          </h2>
          <p>제3자 제공 없음.</p>
          <p>처리 위탁 없음.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            5. 개인정보의 파기
          </h2>
          <p>
            보유기간 경과 또는 처리 목적 달성 시 지체 없이 파기합니다.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            6. 이용자의 권리
          </h2>
          <p>
            이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            7. 로그 및 분석 도구
          </h2>
          <p>서비스 개선을 위해 Mixpanel을 사용합니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            8. 아동의 개인정보 처리
          </h2>
          <p>만 14세 미만도 가입할 수 있습니다.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-gray-700">
          <h2 className="text-base font-semibold text-[#210535]">
            9. 개인정보 보호책임자 및 문의
          </h2>
          <p>책임자: 박채령</p>
          <p>이메일: cpxmate@gmail.com</p>
        </section>

        <section className="mt-6 text-xs text-gray-500">
          시행일: 2025-01-01
        </section>
      </div>
    </main>
  );
}
