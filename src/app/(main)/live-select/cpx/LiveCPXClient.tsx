'use client';
import { useEffect, useState, useRef, useMemo } from "react";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { v4 as uuidv4 } from "uuid";
import SmallHeader from "@/component/SmallHeader";
import BottomFixButton from "@/component/BottomFixButton";
import PlayIcon from "@/asset/icon/PlayIcon.svg";
import PauseIcon from "@/asset/icon/PauseIcon.svg";
import Spinner from "@/component/Spinner";
import { useRouter } from "next/navigation";
import { standardizeToMP3 } from "@/app/utils/audioPreprocessing";
import buildPatientInstructions from "./buildPrompt";
type Props = { category: string; caseName: string };

const INITIAL_SECONDS = 12 * 60; // 720s = 12분

/* =======================
   Mock Data & Types
======================= */
type Vitals = {
    bp: { systolic: number; diastolic: number }; // 혈압
    pulse: number; // 맥박
    rr: number;    // 호흡수
    temp: number;  // 체온(섭씨)
};

type CaseInfo = {
    description: string;
    vitals: Vitals;
};

// 카테고리 → 케이스명 → 데이터
const CASE_MOCK: Record<string, Record<string, CaseInfo>> = {
    소화기: {
        급성복통: {
            description: "56세 남성 홍길동씨가 숨 쉬기가 힘들어 내원하였다.",
            vitals: { bp: { systolic: 140, diastolic: 78 }, pulse: 96, rr: 22, temp: 37.2 },
        },
        소화불량: {
            description: "식후 상복부 불편감과 더부룩함을 호소한다.",
            vitals: { bp: { systolic: 126, diastolic: 82 }, pulse: 84, rr: 18, temp: 36.8 },
        },
    },
    순환기: {
        흉통: {
            description: "계단 오르면 가슴 중앙이 조이는 통증이 발생한다.",
            vitals: { bp: { systolic: 150, diastolic: 90 }, pulse: 98, rr: 20, temp: 36.9 },
        },
    },
    호흡기: {
        호흡곤란: {
            description: "활동 시 숨이 차고 쌕쌕거림이 동반된다.",
            vitals: { bp: { systolic: 132, diastolic: 86 }, pulse: 92, rr: 24, temp: 37.0 },
        },
    },
};

/* 안전 접근 헬퍼 (데이터 없으면 기본값 반환) */
function getCaseData(category: string, caseName: string): CaseInfo {
    const fallback: CaseInfo = {
        description: "증례 설명이 준비 중입니다.",
        vitals: { bp: { systolic: 120, diastolic: 80 }, pulse: 80, rr: 18, temp: 36.8 },
    };
    return CASE_MOCK[category]?.[caseName] ?? fallback;
}

/* °C 포맷 */
const formatTemp = (t: number) => `${t.toFixed(1)}°C`;

export default function LiveCPXClient({ category, caseName }: Props) {
    const router = useRouter();

    // ===== 상태값 =====
    const [isRecording, setIsRecording] = useState(false);
    const [volume, setVolume] = useState(0);
    const [connected, setConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [seconds, setSeconds] = useState<number>(INITIAL_SECONDS);
    const [isFinished, setIsFinished] = useState(false);

    // 케이스 데이터 (메모)
    const caseData = useMemo(() => getCaseData(category, caseName), [category, caseName]);
    // ===== 레퍼런스 =====
    const sessionRef = useRef<any>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const userAudioChunks = useRef<Blob[]>([]);
    const rafRef = useRef<number | null>(null);

    /** 🎧 볼륨 업데이트 */
    const updateVolume = (analyser: AnalyserNode) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setVolume(avg / 255);
            rafRef.current = requestAnimationFrame(loop);
        };
        loop();
    };

    // 카테고리/케이스 변경 시 타이머 초기화
    useEffect(() => {
        setIsRecording(false);
        setIsFinished(false);
        setSeconds(INITIAL_SECONDS);
    }, [category, caseName]);

    // 타이머 진행
    useEffect(() => {
        if (!isRecording || isFinished) return;
        const id = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(id);
                    setIsRecording(false);
                    setIsFinished(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [isRecording, isFinished]);

    /** 🎤 세션 시작 */
    async function startSession() {
        try {
            const res = await fetch("/api/realtime-key");
            const { value } = await res.json();

            const agent = new RealtimeAgent({
                name: "표준화 환자 AI",
                instructions: buildPatientInstructions(caseData),
            });

            const session: any = new RealtimeSession(agent, {
                model: "gpt-4o-realtime-preview",
            });
            sessionRef.current = session;

            await session.connect({ apiKey: value });
            console.log("✅ Connected to OpenAI Realtime API");
            setConnected(true);

            // 🎙 마이크 스트림 수집
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioCtx = new AudioContext();
            const micSrc = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            micSrc.connect(analyser);
            updateVolume(analyser);

            // 🎙 사용자 녹음
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            recorderRef.current = recorder;
            recorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    userAudioChunks.current.push(e.data);

                    // GPT로 실시간 전송
                    const buf = await e.data.arrayBuffer();
                    if ((sessionRef.current as any).input_audio_buffer) {
                        (sessionRef.current as any).input_audio_buffer.append(buf);
                    }
                }
            };

            recorder.start(500); // 500ms마다 chunk 생성
            setIsRecording(true);
        } catch (err) {
            console.error("❌ 세션 연결 실패:", err);
            alert("세션 연결 실패 또는 마이크 접근 거부");
        }
    }

    /** ⏹ 세션 종료 + 사용자 음성만 업로드 */
    async function stopSession() {
        try {
            setIsUploading(true);

            // MediaRecorder 정지
            if (recorderRef.current?.state === "recording") recorderRef.current.stop();

            // 세션 종료
            if (sessionRef.current) await (sessionRef.current as any).close?.();

            // 사용자 음성 webm -> mp3 변환
            const userBlob = new Blob(userAudioChunks.current, { type: "audio/webm" });
            const userMP3 = await standardizeToMP3(userBlob);

            // S3 업로드
            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
            const userKey = `audio/user-audio-${uuidv4()}.mp3`;
            const uploadUrl = await generateUploadUrl(bucket, userKey);

            const res = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "audio/mpeg" },
                body: userMP3,
            });
            if (!res.ok) throw new Error("S3 업로드 실패");

            console.log("✅ 사용자 음성 업로드 완료:", userKey);

            // 채점 페이지로 이동
            router.push(`/score?s3Key=${encodeURIComponent(userKey)}`);
        } catch (err) {
            console.error("❌ 업로드 중 오류:", err);
            alert("업로드 실패");
        } finally {
            cancelAnimationFrame(rafRef.current!);
            setIsRecording(false);
            setConnected(false);
            setIsUploading(false);
        }
    }

    const toggleRecording = () => {
        if (!connected) startSession();
        else stopSession();
    };
    const { bp, pulse, rr, temp } = caseData.vitals;


    // ===== UI =====
    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex flex-col">
                <SmallHeader
                    title={`${category} | ${caseName}`}
                    onClick={() => router.push("/record-select")}
                />

                {/* 설명 */}
                <div className="px-8 pt-4">
                    <p className="text-[#210535] text-[18px] leading-relaxed">
                        {caseData.description}
                    </p>
                </div>

                {/* 바이탈표 (2열 그리드) */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-8 pt-6 pb-12">
                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">혈압</div>
                        <div className="text-[#210535] text-[18px]">
                            {bp.systolic}/{bp.diastolic}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">맥박</div>
                        <div className="text-[#210535] text-[18px]">
                            {pulse}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">호흡수</div>
                        <div className="text-[#210535] text-[18px]">
                            {rr}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">체온</div>
                        <div className="text-[#210535] text-[18px]">
                            {formatTemp(temp)}
                        </div>
                    </div>
                </div>

                <div className="px-8 flex-1 pt-[40px] pb-[136px] flex flex-col items-center justify-center gap-[24px] relative overflow-hidden">
                    {/* 중앙 녹음 버튼 + 볼륨 애니메이션 */}
                    <div className="relative">
                        {isRecording && (
                            <div
                                className="absolute rounded-full transition-transform duration-100 ease-out"
                                style={{
                                    width: "206px",
                                    height: "206px",
                                    top: "49%",
                                    left: "50%",
                                    transform: `translate(-50%, -50%) scale(${1 + volume * 1.5})`,
                                    opacity: 0.3,
                                    background:
                                        "radial-gradient(circle at center, #B1A5E8 0%, #B1A5E8 40%, #BBA6FF 80%, transparent 100%)",
                                    boxShadow: `0 0 ${40 + volume * 50}px #B1A5E8`,
                                }}
                            ></div>
                        )}

                        <button
                            type="button"
                            onClick={toggleRecording}
                            className="outline-none relative z-10 cursor-pointer hover:opacity-70"
                            disabled={isUploading || isRecording}
                        >
                            {isRecording ? (
                                <PauseIcon className="w-[240px] h-[240px] text-[#7553FC] opacity-70" />
                            ) : (
                                <PlayIcon className="w-[240px] h-[240px] text-[#7553FC]" />
                            )}
                        </button>
                    </div>

                    {isUploading && <Spinner borderClassName="border-[#7553FC]" size={40} />}
                </div>

                <BottomFixButton
                    disabled={isUploading}
                    buttonName={isRecording ? "종료 및 채점하기" : "채점하기"}
                    onClick={stopSession}
                />
            </div>
        </div>
    );
}
