'use client';
import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { generateUploadUrl } from "@/app/api/s3/s3";
import SmallHeader from "@/component/SmallHeader";
import BottomFixButton from "@/component/BottomFixButton";
import PlayIcon from "@/assets/icon/PlayIcon.svg";
import PauseIcon from "@/assets/icon/PauseIcon.svg";
import { usePathname, useRouter } from "next/navigation";
import { standardizeToMP3 } from "@/utils/audioPreprocessing";
import buildPatientInstructions from "./buildPrompt";
import { loadVirtualPatient, loadVPProfile, VirtualPatient } from "@/utils/loadVirtualPatient";
import LiveClientPopup from "@/component/LiveClientPopup";
import Image, { StaticImageData } from 'next/image';
import FallbackProfile from "@/assets/virtualPatient/acute_abdominal_pain_001.png"
import { useUserStore } from "@/store/useUserStore";
import toast from "react-hot-toast";
import { fetchOnboardingStatus } from "@/lib/onboarding";
import IdRejectedPopup from "@/component/IdRejectedPopup";
import { postMetadata } from "@/lib/metadata";
import FocusModeOverlay from "@/component/FocusModeOverlay";

type Props = {
    category: string;
    caseName: string;
    scenarioId?: string;
    virtualPatient?: VirtualPatient;
    patientImageUrl?: string;
};

const INITIAL_SECONDS = 12 * 60; // 720s = 12분
const INITIAL_READY_SECONDS = 60; // 준비 시간 60초

/* °C 포맷 */
const formatTemp = (t: number) => `${t.toFixed(1)}°C`;

export default function LiveCPXClient({ category, caseName, scenarioId, virtualPatient, patientImageUrl }: Props) {
    const router = useRouter();

    // ===== 상태값 =====
    const [isRecording, setIsRecording] = useState(false);
    const [volume, setVolume] = useState(0);
    const [connected, setConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [seconds, setSeconds] = useState<number>(INITIAL_SECONDS);
    const [isFinished, setIsFinished] = useState(false);
    const [showPopup, setShowPopup] = useState(false); //가상환자 클릭시 popup 띄우기
    const [readySeconds, setReadySeconds] = useState<number | null>(null); //준비 시간 타이머
    const [conversationText, setConversationText] = useState<string[]>([]);
    const [focusMode, setFocusMode] = useState(false);
    const [verificationPopup, setVerificationPopup] = useState<{
        kind: "missing" | "rejected";
        reason?: string | null;
    } | null>(null);

    const [profileImage, setProfileImage] = useState<StaticImageData>(FallbackProfile);


    // 전역상태 
    const studentId = useUserStore((s: any) => s.studentId);

    //환자 caseData
    const [caseData, setCaseData] = useState<VirtualPatient | null>(null);
    const pathname = usePathname(); // 현재 URL 경로 추적

    const [isPending, startTransition] = useTransition()
    //일시정지 안된다는 상태메시지
    const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined)
    const connectedToastShownRef = useRef(false);

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
            setConversationText([]);
            sessionStartRef.current = 0;
            turnTimestampsRef.current = [];


        } catch (err) {
            console.warn(" 세션 종료 중 오류:", err);
        }
    }, []);

    /** popup show */
    useEffect(() => {
        const isPopupShown = localStorage.getItem("isLiveClientShow");
        if (isPopupShown !== "false") {
            setShowPopup(true)
        }
    }, [setShowPopup])

    // 케이스 프로필 이미지 로드
    useEffect(() => {
        // patientImageUrl이 제공된 경우 우선 사용
        if (patientImageUrl) {
            // URL 문자열인 경우 StaticImageData처럼 사용할 수 없으므로 별도 상태 필요
            return;
        }

        let mounted = true;
        (async () => {
            try {
                const img = await loadVPProfile(caseName);
                if (mounted) setProfileImage(img);
            } catch (e) {
                console.warn("프로필 이미지 로드 실패:", e);
                if (mounted) setProfileImage(FallbackProfile);
            }
        })();
        return () => { mounted = false; };
    }, [caseName, patientImageUrl]);

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
        // virtualPatient가 제공된 경우 우선 사용
        if (virtualPatient) {
            setCaseData(virtualPatient);
            return;
        }

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
    }, [caseName, virtualPatient]);

    // ===== 레퍼런스 =====
    const sessionRef = useRef<any>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const userAudioChunks = useRef<Blob[]>([]);
    const rafRef = useRef<number | null>(null);
    const sessionStartRef = useRef<number>(0);
    const turnTimestampsRef = useRef<{ text: string; elapsedSec: number }[]>([]);

    /** 볼륨 업데이트 */
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

    //12분 초과시 자동 채점 진행
    useEffect(() => {
        if (seconds === 0 && !isUploading && isFinished && !isRecording) {
            stopSession();
        }
    }, [seconds, isUploading, isFinished]);

    /** 세션 시작 */
    async function startSession() {
        if (sessionRef.current || connected || isRecording || isUploading) return;
        try {
            const res = await fetch("/api/realtime-key");
            const { value } = await res.json();

            // 새 스키마(meta at root) 또는 구 스키마(properties.meta) 모두 지원
            const patientSex = caseData?.meta?.sex || caseData?.properties?.meta?.sex;
            const agent = new RealtimeAgent({
                name: "표준화 환자 AI",
                instructions: buildPatientInstructions(caseData as VirtualPatient),
                voice: patientSex === "남성" ? "ash" : "coral"
            });

            const session: any = new RealtimeSession(agent, {
                model: "gpt-realtime-2025-08-28",
                historyStoreAudio: false
            });
            sessionRef.current = session;
            sessionStartRef.current = Date.now();
            turnTimestampsRef.current = [];

            await session.connect({
                apiKey: value,
                speed: 1.5,
                prewarm: true, // 세션 handshake 미리 완료
                eagerness: "high", // 빠른 응답 시작
                turnDetection: {
                    type: "client_vad",
                    silence_duration_ms: 0,
                    autoStart: false, //먼저 발화하지 않도록 설정
                    prefix_padding_ms: 80, //AI 발화시 앞부분 잘리지 않게 padding
                    min_duration_ms: 250, // 너무 짧은 음성(숨소리 등) 무시
                },
            });
            session.on("history_updated", (history: any[]) => {
                // message 타입만 추출
                const parsed = history
                    .filter((h) => h.type === "message" && Array.isArray(h.content))
                    .map((h) => {
                        // content 배열 안에서 transcript나 text 타입만 추출
                        const textItem = h.content.find(
                            (c: any) => c.transcript || c.text
                        );

                        const text = textItem?.transcript || textItem?.text || "";

                        // role에 따라 prefix 붙이기
                        if (h.role === "user") return `의사: ${text}`;
                        if (h.role === "assistant") return `환자: ${text}`;
                        return text;
                    })
                    // transcript가 비어 있으면 제외
                    .filter((line) => line && line.trim().length > 0);

                // 새 턴이 추가될 때마다 timestamp 기록
                if (parsed.length > turnTimestampsRef.current.length) {
                    for (let i = turnTimestampsRef.current.length; i < parsed.length; i++) {
                        turnTimestampsRef.current.push({
                            text: parsed[i],
                            elapsedSec: (Date.now() - sessionStartRef.current) / 1000,
                        });
                    }
                }

                setConversationText(parsed);
            });


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

            recorder.start(100); // 100ms마다 chunk 생성
            setIsRecording(true);
            setConnected(true);
            setFocusMode(true);

        } catch (err) {
            setConnected(false); // 실패 시 다시 false로 복구
            alert("세션 연결 실패 또는 마이크 접근 거부");
        }
    }

    /** ⏹ 세션 종료 + 사용자 음성 및 대화 로그 업로드 */
    async function stopSession() {
        try {
            setIsUploading(true);

            // 녹음 중지
            setIsRecording(false);
            setIsFinished(true);

            if (recorderRef.current?.state === "recording") recorderRef.current.stop();

            // 세션 종료
            if (sessionRef.current) {
                await (sessionRef.current as any).close?.();
                sessionRef.current = null;
            }

            const now = new Date();
            const timestamp = `${now.getFullYear()}.` +
                `${String(now.getMonth() + 1).padStart(2, "0")}.` +
                `${String(now.getDate()).padStart(2, "0")}-` +
                `${String(now.getHours()).padStart(2, "0")}:` +
                `${String(now.getMinutes()).padStart(2, "0")}:` +
                `${String(now.getSeconds()).padStart(2, "0")}`;
            // 사용자 음성 webm → mp3 변환
            const userBlob = new Blob(userAudioChunks.current, { type: "audio/webm" });
            const userMP3 = await standardizeToMP3(userBlob);

            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

            // 사용자 음성 업로드
            const userKey = `VP_user_audio/${studentId}-${timestamp}.mp3`;
            const uploadUrl = await generateUploadUrl(bucket, userKey);

            const res = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "audio/mpeg" },
                body: userMP3,
            });
            if (!res.ok) throw new Error("S3 업로드 실패 (음성)");

            const historyKey = `VP_script/${studentId}-${timestamp}.txt`;
            const timestampsKey = `VP_timestamps/${studentId}-${timestamp}.json`;
            let sessionId: string | null = null;

            const audioMeta = await postMetadata({
                type: "audio",
                s3Key: userKey,
                sessionId,
                caseName,
                origin: "VP",
                fileName: userKey.split("/").pop() || undefined,
                contentType: "audio/mpeg",
                sizeBytes: userMP3.size,
            });
            if (audioMeta.sessionId) sessionId = audioMeta.sessionId;


            // 대화 로그 업로드
            if (conversationText.length > 0) {
                const txtBlob = conversationText.join("\n");

                const uploadHistoryUrl = await generateUploadUrl(bucket, historyKey);

                const histRes = await fetch(uploadHistoryUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "text/plain" },
                    body: txtBlob,
                });
                if (!histRes.ok) throw new Error("S3 업로드 실패 (히스토리)");

                const transcriptMeta = await postMetadata({
                    type: "transcript",
                    s3Key: historyKey,
                    sessionId,
                    caseName,
                    origin: "VP",
                    source: "LIVE",
                    textExcerpt: txtBlob.slice(0, 200),
                    textLength: txtBlob.length,
                    sizeBytes: new Blob([txtBlob]).size,
                });
                if (transcriptMeta.sessionId) sessionId = transcriptMeta.sessionId;
            } else {
                console.warn("⚠️ 대화 내용이 비어 있어 히스토리를 업로드하지 않았습니다.");
            }

            // VP timestamps JSON 업로드
            if (turnTimestampsRef.current.length > 0) {
                const sessionDurationSec = (Date.now() - sessionStartRef.current) / 1000;
                const timestampsPayload = {
                    sessionDurationSec,
                    turns: turnTimestampsRef.current,
                };
                const tsBlob = new Blob(
                    [JSON.stringify(timestampsPayload, null, 2)],
                    { type: "application/json" }
                );
                const uploadTsUrl = await generateUploadUrl(bucket, timestampsKey);
                const tsRes = await fetch(uploadTsUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: tsBlob,
                });
                if (!tsRes.ok) console.warn("VP timestamps 업로드 실패");
            }

            // 채점 페이지로 이동
            startTransition(() => {
                const sessionParam = sessionId
                    ? `&sessionId=${encodeURIComponent(sessionId)}`
                    : "";
                const tsParam = turnTimestampsRef.current.length > 0
                    ? `&timestampsS3Key=${encodeURIComponent(timestampsKey)}`
                    : "";
                router.push(
                    `/score?transcriptS3Key=${encodeURIComponent(historyKey || "")}&caseName=${encodeURIComponent(caseName)}&studentNumber=${encodeURIComponent(studentId)}&origin=${encodeURIComponent("VP")}${sessionParam}${tsParam}`
                );
            });
        } catch (err) {
            console.error("업로드 중 오류:", err);
            alert("업로드 실패");
        } finally {
            cancelAnimationFrame(rafRef.current!);
            setIsRecording(false);
            setConnected(false);
            setIsUploading(false);
        }
    }


    const ensureOnboarding = async () => {
        const result = await fetchOnboardingStatus();
        if (result.status === "missing") {
            setVerificationPopup({ kind: "missing" });
            return false;
        }
        if (result.status === "rejected") {
            setVerificationPopup({
                kind: "rejected",
                reason: result.rejectReason ?? null,
            });
            return false;
        }
        if (result.status === "pending") {
            toast("학생증 확인 중입니다. 승인 완료 후 이용해주세요.", {
                duration: 2500,
            });
            return false;
        }
        return true;
    };

    const toggleRecording = async () => {
        if (!isRecording) {
            const ok = await ensureOnboarding();
            if (!ok) return;
        }
        if (isRecording) {
            setStatusMessage('가상환자와의 대화는 일시정지할 수 없어요');
            return;
        }
        if (!connected) startSession();
        else stopSession();
    };

    const vitalData = caseData?.meta?.vitals || caseData?.properties?.meta?.vitals;

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

    //팝업에서 시작하기 버튼 누른 후 자동으로 준비 시간 카운팅
    const handleReadyStart = () => {
        setShowPopup(false);       // 팝업 닫기
        setReadySeconds(INITIAL_READY_SECONDS); // 준비 타이머 시작
    };

    //60초 끝난 이후 자동으로 시작할 수 있도록 설정
    useEffect(() => {
        if (readySeconds === null) return;

        if (readySeconds > 0) {
            const id = setInterval(() => {
                setReadySeconds((prev) => (prev !== null ? prev - 1 : null));
            }, 1000);
            return () => clearInterval(id);
        } else if (readySeconds === 0) {
            (async () => {
                const ok = await ensureOnboarding();
                if (ok) {
                    startSession(); // 준비 완료 → 실습 시작
                }
                setReadySeconds(null);
            })();
        }
    }, [readySeconds]);

    // 실습 종료 시 자동 집중 모드 해제
    useEffect(() => {
        if (isFinished) setFocusMode(false);
    }, [isFinished]);

    // 연결 완료 알림 토스트
    useEffect(() => {
        if (connected && !connectedToastShownRef.current) {
            connectedToastShownRef.current = true;
            toast.success("지금 시작하세요! 자기소개 및 환자분 성함, 나이를 확인해주세요.", {
                duration: 4000,
                position: "top-center",
            });
        }
        if (!connected) {
            connectedToastShownRef.current = false;
        }
    }, [connected]);


    return (
        <div className="flex flex-col min-h-dvh">
            {verificationPopup && (
                <IdRejectedPopup
                    title={
                        verificationPopup.kind === "missing"
                            ? "실습 기능 이용에는 학생인증이 필요합니다."
                            : undefined
                    }
                    description={
                        verificationPopup.kind === "missing" ? null : undefined
                    }
                    reason={
                        verificationPopup.kind === "rejected"
                            ? verificationPopup.reason ?? null
                            : null
                    }
                    onClose={() => setVerificationPopup(null)}
                    onRegister={() => {
                        setVerificationPopup(null);
                        router.push("/onboarding");
                    }}
                />
            )}
            {showPopup && (
                <LiveClientPopup
                    onClose={() => setShowPopup(false)}
                    onReadyStart={handleReadyStart}
                />
            )}
            <div className="flex flex-col">
                <SmallHeader
                    title={`${category} | ${caseName}`}
                    onClick={() => router.push("/live-select")}
                />
                {/* 프로필 */}
                <div className="px-6 pt-4 w-full flex items-center gap-4">
                    <div className="w-[56px] h-[56px] relative">
                        <Image
                            src={patientImageUrl || profileImage}
                            alt="ProfileImage"
                            className="overflow-hidden rounded-full object-cover"
                            fill
                            unoptimized={!!patientImageUrl}
                        />
                    </div>
                    <div className="text-[16px] items-center">
                        <p>
                            {caseData?.meta?.name || caseData?.properties?.meta?.name}
                        </p>
                        <p className="text-[14px] text-gray-500">
                            {caseData?.meta?.sex || caseData?.properties?.meta?.sex}
                            {" | "}
                            {caseData?.meta?.age || caseData?.properties?.meta?.age}세
                        </p>
                    </div>
                </div>
                <div className="w-full px-6 pt-3">
                    <div className="w-full border-b border-gray-300" />
                </div>
                {/* 설명 */}
                <div className="px-8 pt-3">
                    <p className="text-[#210535] text-[15px] leading-relaxed">
                        {caseData?.description}
                    </p>
                </div>

                {/* 바이탈표 (2열 그리드) */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-2 px-8 pt-3 pb-6">
                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[15px]">혈압</div>
                        <div className="text-[#210535] text-[15px]">
                            {vitalData?.bp}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[15px]">맥박</div>
                        <div className="text-[#210535] text-[15px]">
                            {vitalData?.hr}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[15px]">호흡수</div>
                        <div className="text-[#210535] text-[15px]">
                            {vitalData?.rr}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="text-[#210535] font-semibold text-[15px]">체온</div>
                        <div className="text-[#210535] text-[15px]">
                            {formatTemp(Number(vitalData?.bt))}
                        </div>
                    </div>
                </div>

                <div className="px-8 flex-1 pb-[136px] flex flex-col items-center justify-center gap-[12px] relative overflow-hidden">
                    {/* 타이머 */}
                    <div className="font-semibold text-[#7553FC] flex gap-2 items-center">
                        {readySeconds !== null && !isRecording && !isFinished ? (
                            <div className="text-center">
                                <span className="text-[22px] ">
                                    {readySeconds}초
                                </span>
                                <span>
                                    {" "}
                                </span>
                                <span className="font-medium text-[16px]">
                                    후 실습이 시작됩니다.
                                    <br />
                                    준비되었다면 <span className="font-bold">플레이 버튼</span>을 눌러주세요.
                                </span>

                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-[22px] ">
                                    {showTime(seconds)}
                                </span>
                                {/* 집중 모드 재진입 버튼 */}
                                {isRecording && !focusMode && (
                                    <button
                                        type="button"
                                        onClick={() => setFocusMode(true)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F3F0FF] hover:bg-[#E9E2FF] transition cursor-pointer"
                                        title="집중 모드"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7553FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="15 3 21 3 21 9" />
                                            <polyline points="9 21 3 21 3 15" />
                                            <line x1="21" y1="3" x2="14" y2="10" />
                                            <line x1="3" y1="21" x2="10" y2="14" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {/* 중앙 녹음 버튼 + 볼륨 애니메이션 */}
                    <div className="relative">
                        {isRecording && (
                            <div
                                className="absolute rounded-full transition-transform duration-100 ease-out"
                                style={{
                                    width: "170px",
                                    height: "170px",
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
                            disabled={isUploading || connected || isFinished}
                        >
                            {isRecording ? (
                                <PauseIcon className="w-[180px] h-[180px] text-[#7553FC] opacity-70" />
                            ) : (
                                <PlayIcon className="w-[180px] h-[180px] text-[#7553FC]" />
                            )}
                        </button>

                    </div>
                </div>

                <BottomFixButton
                    disabled={isUploading || seconds == INITIAL_SECONDS}
                    buttonName={"종료 및 채점하기"}
                    onClick={stopSession}
                    loading={isPending || isUploading}
                />
                {statusMessage && (
                    <>
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
                    </>

                )}
            </div>

            <FocusModeOverlay
                isOpen={focusMode}
                onClose={() => setFocusMode(false)}
                isRecording={isRecording}
                volume={volume}
                onToggleRecording={toggleRecording}
                disabled={isUploading || connected || isFinished}
                patientImage={patientImageUrl || profileImage}
                patientName={caseData?.meta?.name || caseData?.properties?.meta?.name}
            />
        </div >
    );
}
