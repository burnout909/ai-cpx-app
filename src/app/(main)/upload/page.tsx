'use client';

import { useState } from "react";
import MediaUploadBox from "@/component/MediaFileUploader";
import BottomFixButton from "@/component/BottomFixButton";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";

export default function UploadPage() {
    const [uploadFileName, setUploadFileName] = useState<string | null>(null);
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const router = useRouter();

    const handleUpload = async (file: File) => {
        setIsUploadLoading(true);
        try {
            // TODO: 실제 업로드 로직 (예: S3 업로드, 서버 전송 등)
            // await uploadToS3(file)
            await new Promise((r) => setTimeout(r, 1200)); // 데모용
        } catch (e) {
            console.error(e);
            setUploadFileName(null);
        } finally {
            setIsUploadLoading(false);
        }
    };

    async function handleSubmit() {
        alert("채점하기")
    }

    return (
        <div className="flex flex-col">
            <SmallHeader
                title={"실습 파일 업로드"}
                onClick={() => router.push('/home')} />
            <main className="flex-1 px-8 pt-4">
                <MediaUploadBox
                    onUpload={handleUpload}
                    uploadFileName={uploadFileName}
                    setUploadFileName={setUploadFileName}
                    isUploadLoading={isUploadLoading}
                />
            </main>
            <BottomFixButton
                disabled={!uploadFileName || isUploadLoading}
                onClick={handleSubmit}
                buttonName={"채점하기"}
            />
        </div>
    );
}
