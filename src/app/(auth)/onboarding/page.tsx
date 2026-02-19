"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateUploadUrl } from "@/app/api/s3/s3";
import toast, { Toaster } from "react-hot-toast";
import { track } from "@/lib/mixpanel";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStudentNumber = (value: string) => {
    const onlyDigits = value.replace(/[^0-9]/g, "").slice(0, 10);
    setStudentNumber(onlyDigits);
  };

  const validate = () => {
    if (!name.trim()) return "이름을 입력해주세요.";
    if (!/^\d{4}191\d{3}$/.test(studentNumber)) {
      return "학번은 'XXXX191XXX' 형식의 10자리 숫자여야 합니다.";
    }
    if (!file) return "학생증 이미지를 업로드해주세요.";
    return null;
  };

  const handleSubmit = async () => {
    track("auth_onboarding_submitted");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
      if (!bucket) {
        throw new Error("S3 bucket이 설정되어 있지 않습니다.");
      }

      const fileExt = file!.name.split(".").pop() || "jpg";
      const safeId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const s3Key = `student_id/${user.id}/${safeId}.${fileExt}`;

      const presigned = await generateUploadUrl(bucket, s3Key);
      const uploadRes = await fetch(presigned, {
        method: "PUT",
        headers: {
          "Content-Type": file!.type || "application/octet-stream",
        },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("학생증 업로드에 실패했습니다.");
      }

      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          studentNumber,
          s3Key,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "등록에 실패했습니다.");
      }

      track("auth_onboarding_completed");
      toast.success("1영업일 이내에 처리될 예정입니다.");
      router.replace("/home");
    } catch (err: any) {
      track("auth_onboarding_error", { error: err?.message });
      setError(err?.message || "등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
      <Toaster reverseOrder={false} />
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-8">
        <h1 className="text-[20px] font-semibold text-[#210535]">
          프로필 등록
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          이름, 학번, 학생증 이미지를 등록해주세요.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="h-11 rounded-lg border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7553FC]"
          />
          <input
            type="text"
            value={studentNumber}
            onChange={(e) => handleStudentNumber(e.target.value)}
            placeholder="학번 (예: 2023191000)"
            className="h-11 rounded-lg border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7553FC]"
          />
          <label className="flex flex-col gap-2 text-sm text-gray-600">
            <span>학생증 이미지</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-11 rounded-lg bg-[#7553FC] text-white text-sm font-medium disabled:opacity-50"
          >
            등록하기
          </button>
        </div>
      </div>
    </main>
  );
}
