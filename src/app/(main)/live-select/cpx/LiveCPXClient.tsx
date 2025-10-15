'use client';
import { useEffect, useState, useRef, useMemo, useCallback, useTransition } from "react";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { v4 as uuidv4 } from "uuid";
import SmallHeader from "@/component/SmallHeader";
import BottomFixButton from "@/component/BottomFixButton";
import PlayIcon from "@/assets/icon/PlayIcon.svg";
import PauseIcon from "@/assets/icon/PauseIcon.svg";
import Spinner from "@/component/Spinner";
import { usePathname, useRouter } from "next/navigation";
import { standardizeToMP3 } from "@/app/utils/audioPreprocessing";
import buildPatientInstructions from "./buildPrompt";
import { loadVirtualPatient, VirtualPatient } from "@/utils/loadVirtualPatient";
type Props = { category: string; caseName: string };

const INITIAL_SECONDS = 12 * 60; // 720s = 12분
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
    //환자 caseData
    const [caseData, setCaseData] = useState<VirtualPatient | null>(null);
    const pathname = usePathname(); // 현재 URL 경로 추적

    const [isPending, startTransition] = useTransition()
    //일시정지 안된다는 상태메시지
    const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined)

    /**stopSession */
    const stopAndResetSession = useCallback(async () => {
        try {
            // 세션 종료
            if (sessionRef.current) {
                await (sessionRef.current as any).close?.();
                sessionRef.current = null;
            }
            // 녹음 중단
            if (recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
            }
            recorderRef.current = null;
            userAudioChunks.current = [];
            cancelAnimationFrame(rafRef.current!);

            // 상태 초기화
            setIsRecording(false);
            setConnected(false);
            setIsUploading(false);
            setIsFinished(false);
            setVolume(0);
            setSeconds(INITIAL_SECONDS);

        } catch (err) {
            console.warn(" 세션 종료 중 오류:", err);
        }
    }, []);

    /** 라우트 변경 시 자동 정리 */
    useEffect(() => {
        // 경로가 /live-select/cpx 가 아니면 정리
        if (pathname !== "/live-select/cpx") {
            stopAndResetSession();
        }
    }, [pathname, stopAndResetSession]);

    /** 페이지 이탈(새로고침, 닫기) 감지 */
    useEffect(() => {
        const handleUnload = () => {
            if (pathname === "/live-select/cpx") {
                stopAndResetSession();
            }
        };
        window.addEventListener("beforeunload", handleUnload);
        return () => {
            window.removeEventListener("beforeunload", handleUnload);
        };
    }, [pathname, stopAndResetSession]);

    /** 컴포넌트 언마운트 시 정리 (ex. Next.js 라우팅 이동) */
    useEffect(() => {
        return () => {
            stopAndResetSession();
        };
    }, [stopAndResetSession]);
    useEffect(() => {
        let isMounted = true;

        async function fetchCaseData() {
            try {
                const data = await loadVirtualPatient(caseName);
                if (isMounted) setCaseData(data);
            } catch (err) {
                console.error("가상환자 로드 실패:", err);
            }
        }

        if (caseName) fetchCaseData();

        return () => {
            isMounted = false;
        };
    }, [caseName]);

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
                instructions: buildPatientInstructions(caseData as VirtualPatient),
                voice: "ash"
            });

            const session: any = new RealtimeSession(agent, {
                model: "gpt-realtime-mini-2025-10-06",
            });
            sessionRef.current = session;

            await session.connect({
                apiKey: value,
                speed: 1.5,
                turnDetection: {
                    type: "server_vad", //서버 기반 voice detection
                    silence_duration_ms: 200,   // 0.2초 침묵 → 턴 종료 판단
                    autoStart: false, //먼저 발화하지 않도록 설정
                    prefix_padding_ms: 150, //AI 발화시 앞부분 잘리지 않게 padding
                    min_duration_ms: 250, // 너무 짧은 음성(숨소리 등) 무시
                },
            });
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

            // 채점 페이지로 이동
            startTransition(() => {
                router.push(`/score?s3Key=${encodeURIComponent(userKey)}&caseName=${encodeURIComponent(caseName)}`);
            })
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
        if (isRecording) {
            setStatusMessage('가상환자와의 대화는 일시정지할 수 없어요')
            return;
        }
        if (!connected) startSession();
        else stopSession();
    };

    const vitalData = caseData?.properties.meta.vitals;

    const showTime = useCallback((sec: number) => {
        const mm = Math.floor(sec / 60).toString().padStart(2, "0");
        const ss = (sec % 60).toString().padStart(2, "0");
        return `${mm}:${ss}`;
    }, []);

    // 3초 후 자동 사라지는 toast
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(undefined), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);


    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex flex-col">
                <SmallHeader
                    title={`${category} | ${caseName}`}
                    onClick={() => router.push("/live-select")}
                />

                {/* 설명 */}
                <div className="px-8 pt-4">
                    <p className="text-[#210535] text-[18px] leading-relaxed">
                        {caseData?.description}
                    </p>
                </div>

                {/* 바이탈표 (2열 그리드) */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-8 pt-4 pb-6">
                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">혈압</div>
                        <div className="text-[#210535] text-[18px]">
                            {vitalData?.bp}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">맥박</div>
                        <div className="text-[#210535] text-[18px]">
                            {vitalData?.hr}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">호흡수</div>
                        <div className="text-[#210535] text-[18px]">
                            {vitalData?.rr}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[18px]">체온</div>
                        <div className="text-[#210535] text-[18px]">
                            {formatTemp(Number(vitalData?.bt))}
                        </div>
                    </div>
                </div>

                <div className="px-8 flex-1 pb-[136px] flex flex-col items-center justify-center gap-[12px] relative overflow-hidden">
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
                            className="outline-none relative cursor-pointer hover:opacity-70
                                                    transition-transform duration-150 ease-out active:scale-90"
                            disabled={isUploading}
                        >
                            {isRecording ? (
                                <PauseIcon className="w-[240px] h-[240px] text-[#7553FC] opacity-70" />
                            ) : (
                                <PlayIcon className="w-[240px] h-[240px] text-[#7553FC]" />
                            )}
                        </button>

                    </div>
                    {/* 타이머 */}
                    <div className="font-semibold text-[36px] text-[#7553FC] flex gap-2 items-center">
                        {showTime(seconds)}
                    </div>
                </div>

                <BottomFixButton
                    disabled={isUploading || seconds == 720}
                    buttonName={"종료 및 채점하기"}
                    onClick={stopSession}
                    loading={isPending || isUploading}
                />
                {statusMessage && (
                    <div
                        className="
                        fixed bottom-30 left-1/2 -translate-x-1/2 
                        bg-[#c7beeeff] text-[#210535] text-[18px] font-medium 
                        px-4 py-3 rounded-xl shadow-lg flex z-[100]
                        animate-slideUpFade flex justify-center items-center w-[calc(100%-40px)]
                        "
                    >
                        {statusMessage}
                    </div>
                )}
            </div>
        </div >
    );
}
