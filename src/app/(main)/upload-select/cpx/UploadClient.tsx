'use client';

import { useState, useTransition } from "react";
import MediaUploadBox from "@/component/MediaFileUploader";
import BottomFixButton from "@/component/BottomFixButton";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { standardizeToMP3 } from "@/app/utils/audioPreprocessing";
import { generateUploadUrl } from "@/app/api/s3/s3";
import Spinner from "@/component/Spinner";

type Props = { category: string; caseName: string };

export default function UploadClient({ category, caseName }: Props) {
    const [uploadFileName, setUploadFileName] = useState<string | null>(null);
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
    const [isUploadingToS3, setIsUploadingToS3] = useState(false);
    const router = useRouter();
    const [isPending, startTransition] = useTransition()

    // 파일 업로드 (로컬 변환 + 미리듣기)
    const handleUpload = async (file: File) => {
        setIsUploadLoading(true);
        setAudioUrl(null);
        setMp3Blob(null);
        try {
            setUploadFileName(file.name);

            // 변환 (브라우저에서 MP3로 표준화)
            const converted = await standardizeToMP3(file);
            const url = URL.createObjectURL(converted);

            setAudioUrl(url);
            setMp3Blob(converted);
        } catch (e) {
            console.error(e);
            alert("⚠️ 변환 중 오류가 발생했습니다.");
            setUploadFileName(null);
            setAudioUrl(null);
            setMp3Blob(null);
        } finally {
            setIsUploadLoading(false);
        }
    };

    // 채점 버튼 클릭 → S3 업로드 → /score로 이동
    async function handleSubmit() {
        if (!mp3Blob || !uploadFileName) {
            alert("먼저 오디오 파일을 업로드해주세요!");
            return;
        }

        try {
            setIsUploadingToS3(true);

            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
            const fileName = uploadFileName.replace(/\.[^/.]+$/, ""); // 확장자 제거
            const key = `uploads/${uuidv4()}-${fileName}.mp3`;

            // Presigned URL 생성
            const uploadUrl = await generateUploadUrl(bucket, key);

            // 업로드 실행
            const res = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "audio/mpeg" },
                body: mp3Blob,
            });

            if (!res.ok) throw new Error("S3 업로드 실패");

            // 3️⃣ 성공 시 채점 페이지로 이동
            startTransition(() => {
                router.push(`/score?s3Key=${encodeURIComponent(key)}&caseName=${encodeURIComponent(caseName)}`);
            })
        } catch (err: any) {
            console.error(err);
            alert(`업로드 중 오류: ${err.message || "알 수 없는 오류"}`);
        } finally {
            setIsUploadingToS3(false);
        }
    }

    return (
        <div className="flex flex-col relative min-h-screen">
            <SmallHeader
                title={`${caseName} 파일 업로드`}
                onClick={() => router.push('/home')}
            />

            {/* 메인 컨텐츠 */}
            <main className="flex-1 px-5 pt-4 flex flex-col items-center">
                <MediaUploadBox
                    onUpload={handleUpload}
                    uploadFileName={uploadFileName}
                    setUploadFileName={setUploadFileName}
                    isUploadLoading={isUploadLoading}
                />

                {/* 변환된 오디오 미리듣기 */}
                {audioUrl && (
                    <div className="mt-8 w-full flex flex-col items-center">
                        <audio
                            controls
                            src={audioUrl}
                            className="w-full rounded-[12px]"
                        />
                    </div>
                )}
            </main>


            {/* 하단 버튼 */}
            <BottomFixButton
                disabled={!mp3Blob || isUploadLoading || isUploadingToS3}
                onClick={handleSubmit}
                buttonName={"채점하기"}
                loading={isPending || isUploadingToS3}
            />
        </div>
    );
}
