import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import Spinner from "./Spinner";

interface MediaUploadBoxProps {
    onUpload: (file: File) => void;
    uploadFileName: string | null;
    setUploadFileName: Dispatch<SetStateAction<string | null>>;
    isUploadLoading: boolean;
}

// 허용 확장자
const ALLOWED_MIME_TYPES = new Set<string>([
    "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac",
    "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm",
    "video/mp4", "video/quicktime", "video/webm",
]);

const ALLOWED_EXTS = new Set<string>([
    "mp3", "m4a", "aac", "wav", "ogg", "webm", "mp4", "mov",
]);

function isAllowedFile(file: File) {
    if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true;
    const name = file.name.toLowerCase();
    const ext = name.split(".").pop() || "";
    return ALLOWED_EXTS.has(ext);
}

export default function MediaUploadBox(props: MediaUploadBoxProps) {
    const {
        onUpload,
        uploadFileName,
        setUploadFileName,
        isUploadLoading,
    } = props;

    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePick = (file?: File) => {
        if (!file) return;
        if (!isAllowedFile(file)) {
            setError("오디오(mp3/m4a/wav/ogg) 또는 비디오(mp4/mov/webm)만 업로드할 수 있어요.");
            return;
        }
        setError(null);
        onUpload(file);
        setUploadFileName(file.name);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        handlePick(file);
    };

    return (
        <div className="w-full space-y-2">
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`min-h-[200px] relative w-full px-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all
          ${dragOver
                        ? "border-[#7553FC] bg-[#7553FC]/10"
                        : "border-[#D0C7FA] bg-[#F4F1FF] py-12"
                    }
        `}
            >
                {/* 숨겨진 input */}
                <input
                    ref={inputRef}
                    type="file"
                    accept="
            audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,
            video/mp4,video/quicktime,video/webm,
            .mp3,.m4a,.aac,.wav,.ogg,.webm,.mp4,.mov
          "
                    onChange={(e) => handlePick(e.target.files?.[0] || undefined)}
                    className="hidden"
                    disabled={isUploadLoading}
                />

                {/* 로딩 중 */}
                {isUploadLoading ? (
                    <>
                        <Spinner className="mb-3" borderClassName="border-[#603EEA]" />
                        <p className="text-[16px] text-[#603EEA] font-medium">
                            파일 업로드 중
                        </p>
                    </>
                ) : uploadFileName ? (
                    /* 파일 선택됨 */
                    <>
                        <p className="text-[16px] text-[#603EEA] font-medium">
                            {uploadFileName}
                        </p>
                        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/20 flex items-center justify-center rounded-lg">
                            <div className="text-white bg-[#7553FC] px-4 py-2 text-[13px] rounded-lg font-medium">
                                다른 파일 선택
                            </div>
                        </div>
                    </>
                ) : (
                    /* 기본 상태 */
                    <>
                        <div className="text-white text-[13px] bg-[#7553FC] px-4 py-2 rounded-[8px] font-medium">
                            오디오 업로드
                        </div>
                        <p className="text-[#210535] text-[14px] mt-2 opacity-70">
                            오디오 파일을 선택하거나 드래그 해주세요
                        </p>
                    </>
                )}

                {/* 에러 메시지 */}
                {error && (
                    <p className="mt-3 text-[12px] text-red-500">{error}</p>
                )}
            </div>
        </div>
    );
}
