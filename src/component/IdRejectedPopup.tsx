"use client";

type Props = {
  title?: string;
  description?: string | null;
  reason?: string | null;
  onClose: () => void;
  onRegister: () => void;
};

export default function IdRejectedPopup({
  title,
  description,
  reason,
  onClose,
  onRegister,
}: Props) {
  const resolvedTitle = title ?? "학생증 등록이 거절되었습니다.";
  const resolvedDescription =
    description === undefined ? "다시 등록해주세요." : description;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="w-[90%] max-w-[360px] rounded-2xl bg-white p-6 text-center shadow-lg">
        <h2 className="text-[18px] font-semibold text-[#210535]">
          {resolvedTitle}
        </h2>
        {resolvedDescription ? (
          <p className="mt-2 text-[15px] text-[#4b3d6e]">
            {resolvedDescription}
          </p>
        ) : null}
        {reason ? (
          <p className="mt-3 rounded-lg bg-[#F5F2FF] px-3 py-2 text-[14px] text-[#4b3d6e]">
            거절 사유: {reason}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-[15px] font-medium text-[#4b3d6e] hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            onClick={onRegister}
            className="flex-1 rounded-lg bg-[#7553FC] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#6743f0]"
          >
            등록하기
          </button>
        </div>
      </div>
    </div>
  );
}
