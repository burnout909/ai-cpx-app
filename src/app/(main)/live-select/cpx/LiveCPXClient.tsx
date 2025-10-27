'use client';
import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { v4 as uuidv4 } from "uuid";
import SmallHeader from "@/component/SmallHeader";
import BottomFixButton from "@/component/BottomFixButton";
import PlayIcon from "@/assets/icon/PlayIcon.svg";
import PauseIcon from "@/assets/icon/PauseIcon.svg";
import { usePathname, useRouter } from "next/navigation";
import { standardizeToMP3 } from "@/utils/audioPreprocessing";
import buildPatientInstructions from "./buildPrompt";
import { loadVirtualPatient, VirtualPatient } from "@/utils/loadVirtualPatient";
import LiveClientPopup from "@/component/LiveClientPopup";

type Props = { category: string; caseName: string };

const INITIAL_SECONDS = 12 * 60; // 12분
const INITIAL_READY_SECONDS = 60; // 준비시간 60초
const formatTemp = (t: number) => `${t.toFixed(1)}°C`;

export default function LiveCPXClient({ category, caseName }: Props) {
    const router = useRouter();

    // ===== 상태 =====
    const [isRecording, setIsRecording] = useState(false);
    const [volume, setVolume] = useState(0);
    const [connected, setConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [seconds, setSeconds] = useState(INITIAL_SECONDS);
    const [isFinished, setIsFinished] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [readySeconds, setReadySeconds] = useState<number | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>();
    const [caseData, setCaseData] = useState<VirtualPatient | null>(null);
    const [isPending, startTransition] = useTransition();
    const [transcript, setTranscript] = useState<string>(""); // 📝 전사본

    const pathname = usePathname();

    // ===== 레퍼런스 =====
    const sessionRef = useRef<any>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const rafRef = useRef<number | null>(null);
    const mixedChunks = useRef<Blob[]>([]); // 🎧 사람+AI 혼합 오디오
    const audioCtxRef = useRef<AudioContext | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    /** 세션 정리 */
    const stopAndResetSession = useCallback(async () => {
        try {
            if (sessionRef.current) {
                await (sessionRef.current as any).close?.();
                sessionRef.current = null;
            }
            if (recorderRef.current?.state === "recording") recorderRef.current.stop();
            recorderRef.current = null;
            cancelAnimationFrame(rafRef.current!);
            mixedChunks.current = [];
            setIsRecording(false);
            setConnected(false);
            setIsUploading(false);
            setIsFinished(false);
            setVolume(0);
            setSeconds(INITIAL_SECONDS);
            setTranscript("");
        } catch (err) {
            console.warn("세션 종료 오류:", err);
        }
    }, []);

    /** 초기화 */
    useEffect(() => {
        const isPopupShown = localStorage.getItem("isLiveClientShow");
        if (isPopupShown !== "false") setShowPopup(true);
    }, []);

    /** 언마운트 시 정리 */
    useEffect(() => {
        return () => { stopAndResetSession() };
    }, [stopAndResetSession]);

    /** caseData 로드 */
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await loadVirtualPatient(caseName);
                if (mounted) setCaseData(data);
            } catch (err) {
                console.error("가상환자 로드 실패:", err);
            }
        })();
        return () => { mounted = false; };
    }, [caseName]);

    /** 🎧 볼륨 표시 */
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

    /** 타이머 */
    useEffect(() => {
        if (!isRecording || isFinished) return;
        const id = setInterval(() => {
            setSeconds((s) => {
                if (s <= 1) {
                    clearInterval(id);
                    setIsRecording(false);
                    setIsFinished(true);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [isRecording, isFinished]);

    useEffect(() => {
        if (seconds === 0 && !isUploading && isFinished && !isRecording) stopSession();
    }, [seconds, isUploading, isFinished]);

    /** 🎤 세션 시작 */
    async function startSession() {
        if (sessionRef.current || connected || isRecording || isUploading) return;
        setConnected(true);

        try {
            const res = await fetch("/api/realtime-key");
            const { value } = await res.json();

            const agent = new RealtimeAgent({
                name: "표준화 환자 AI",
                instructions: buildPatientInstructions(caseData as VirtualPatient),
                voice: "ash",
            });

            const session: any = new RealtimeSession(agent, {
                model: "gpt-realtime-2025-08-28",
            });
            sessionRef.current = session;

            await session.connect({
                apiKey: value,
                speed: 1.5,
                prewarm: true,
                turnDetection: {
                    type: "client_vad",
                    silence_duration_ms: 0,
                    autoStart: false,
                },
            });

            // 🎧 AudioContext 구성
            const audioCtx = new AudioContext();
            const destination = audioCtx.createMediaStreamDestination();
            audioCtxRef.current = audioCtx;
            destinationRef.current = destination;

            // 🎙 사용자 입력
            const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const micSrc = audioCtx.createMediaStreamSource(userStream);
            const analyser = audioCtx.createAnalyser();
            micSrc.connect(analyser);
            micSrc.connect(destination);
            updateVolume(analyser);

            // 🎧 AI 오디오 출력도 destination에 연결
            session.on("output_audio", (data: ArrayBuffer) => {
                const blob = new Blob([data], { type: "audio/mpeg" });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                const source = audioCtx.createMediaElementSource(audio);
                source.connect(destination);
                audio.play();
            });

            // 전사본 누적
            // 전사본 누적
            session.on("message", (msg: any) => {
                console.log("📩 [MESSAGE RECEIVED]", msg); // ✅ 메시지 전체 구조 확인용 로그

                if (msg.role === "user") {
                    console.log("👤 사용자 메시지:", msg.content?.[0]?.text);
                    setTranscript((p) => p + `사용자: ${msg.content?.[0]?.text ?? ""}\n`);
                } else if (msg.role === "assistant") {
                    console.log("🤖 가상환자 메시지:", msg.content?.[0]?.text);
                    setTranscript((p) => p + `가상환자: ${msg.content?.[0]?.text ?? ""}\n`);
                } else {
                    console.log("⚙️ 기타 메시지 역할:", msg.role);
                }
            });

            session.on("response", (res: any) => {
                console.log("🪄 [RESPONSE EVENT]", res);
            });


            // 🎬 통합 오디오 녹음 시작
            const mixedRecorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm" });
            recorderRef.current = mixedRecorder;
            mixedRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) mixedChunks.current.push(e.data);
            };
            mixedRecorder.start(500);
            setIsRecording(true);

        } catch (err) {
            console.error("세션 연결 실패:", err);
            setConnected(false);
            alert("세션 연결 실패 또는 마이크 접근 거부");
        }
    }

    /** ⏹ 세션 종료 + 업로드 */
    async function stopSession() {
        try {
            setIsUploading(true);
            setIsRecording(false);
            setIsFinished(true);
            if (recorderRef.current?.state === "recording") recorderRef.current.stop();
            if (sessionRef.current) await (sessionRef.current as any).close?.();
            cancelAnimationFrame(rafRef.current!);

            // 통합 오디오 MP3 변환
            const conversationBlob = new Blob(mixedChunks.current, { type: "audio/webm" });
            const conversationMP3 = await standardizeToMP3(conversationBlob);

            // 전사본 Blob
            const transcriptBlob = new Blob([transcript], { type: "text/plain" });

            // S3 업로드
            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
            const audioKey = `audio/conversation-${uuidv4()}.mp3`;
            const transcriptKey = `transcript/transcript-${uuidv4()}.txt`;

            const [audioUrl, txtUrl] = await Promise.all([
                generateUploadUrl(bucket, audioKey),
                generateUploadUrl(bucket, transcriptKey),
            ]);

            await Promise.all([
                fetch(audioUrl, { method: "PUT", headers: { "Content-Type": "audio/mpeg" }, body: conversationMP3 }),
                fetch(txtUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: transcriptBlob }),
            ]);

            startTransition(() => {
                router.push(`/score?s3Key=${encodeURIComponent(audioKey)}&caseName=${encodeURIComponent(caseName)}`);
            });
        } catch (err) {
            console.error("❌ 업로드 오류:", err);
            alert("업로드 실패");
        } finally {
            setConnected(false);
            setIsUploading(false);
        }
    }

    const toggleRecording = () => {
        if (isRecording) {
            setStatusMessage("가상환자와의 대화는 일시정지할 수 없어요");
            return;
        }
        if (!connected) startSession();
        else stopSession();
    };

    // UI ====
    const vitalData = caseData?.properties.meta.vitals;
    const showTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(undefined), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const handleReadyStart = () => {
        setShowPopup(false);
        setReadySeconds(INITIAL_READY_SECONDS);
    };

    useEffect(() => {
        if (readySeconds === null) return;
        if (readySeconds > 0) {
            const id = setInterval(() => setReadySeconds((p) => (p !== null ? p - 1 : null)), 1000);
            return () => clearInterval(id);
        } else if (readySeconds === 0) {
            startSession();
            setReadySeconds(null);
        }
    }, [readySeconds]);

    return (
        <div className="flex flex-col min-h-dvh">
            {showPopup && <LiveClientPopup onClose={() => setShowPopup(false)} onReadyStart={handleReadyStart} />}
            <div className="flex flex-col">
                <SmallHeader title={`${category} | ${caseName}`} onClick={() => router.push("/live-select")} />

                {/* 설명 */}
                <div className="px-8 pt-4">
                    <p className="text-[#210535] text-[18px] leading-relaxed">{caseData?.description}</p>
                </div>

                {/* 바이탈 */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-8 pt-4 pb-6">
                    <div className="flex gap-2"><div className="font-semibold">혈압</div><div>{vitalData?.bp}</div></div>
                    <div className="flex gap-2"><div className="font-semibold">맥박</div><div>{vitalData?.hr}</div></div>
                    <div className="flex gap-2"><div className="font-semibold">호흡수</div><div>{vitalData?.rr}</div></div>
                    <div className="flex gap-2"><div className="font-semibold">체온</div><div>{formatTemp(Number(vitalData?.bt))}</div></div>
                </div>

                {/* 중앙 */}
                <div className="px-8 flex-1 pb-[136px] flex flex-col items-center justify-center gap-[12px] relative overflow-hidden">
                    <div className="relative">
                        {isRecording && (
                            <div className="absolute rounded-full transition-transform duration-100 ease-out"
                                style={{
                                    width: "206px", height: "206px", top: "49%", left: "50%",
                                    transform: `translate(-50%, -50%) scale(${1 + volume * 1.5})`,
                                    opacity: 0.3, background: "radial-gradient(circle, #B1A5E8, #BBA6FF 80%, transparent)",
                                    boxShadow: `0 0 ${40 + volume * 50}px #B1A5E8`,
                                }}
                            ></div>
                        )}
                        <button
                            type="button"
                            onClick={toggleRecording}
                            className="outline-none relative cursor-pointer hover:opacity-70 transition-transform duration-150 ease-out active:scale-90"
                            disabled={isUploading || connected || isFinished}
                        >
                            {isRecording ? (
                                <PauseIcon className="w-[240px] h-[240px] text-[#7553FC] opacity-70" />
                            ) : (
                                <PlayIcon className="w-[240px] h-[240px] text-[#7553FC]" />
                            )}
                        </button>
                    </div>

                    {/* 타이머 */}
                    <div className="font-semibold text-[#7553FC]">
                        {readySeconds !== null && !isRecording && !isFinished ? (
                            <div className="text-center">
                                <span className="text-[36px]">{readySeconds}초</span>
                                <span className="font-medium text-[20px]"><br />후 실습이 시작됩니다.<br />준비되었다면 <span className="font-bold">플레이 버튼</span>을 눌러주세요.</span>
                            </div>
                        ) : (
                            <span className="text-[36px]">{showTime(seconds)}</span>
                        )}
                    </div>
                </div>

                <BottomFixButton
                    disabled={isUploading || seconds == INITIAL_SECONDS}
                    buttonName={"종료 및 채점하기"}
                    onClick={stopSession}
                    loading={isPending || isUploading}
                />

                {statusMessage && (
                    <div className="fixed bottom-30 left-1/2 -translate-x-1/2 bg-[#c7beeeff] text-[#210535] text-[18px] font-medium 
              px-4 py-3 rounded-xl shadow-lg flex z-[100] animate-slideUpFade justify-center items-center w-[calc(100%-40px)]">
                        {statusMessage}
                    </div>
                )}
            </div>
        </div>
    );
}
