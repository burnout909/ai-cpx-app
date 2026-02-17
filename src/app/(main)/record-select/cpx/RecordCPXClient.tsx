'use client';

import BottomFixButton from "@/component/BottomFixButton";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useTransition, use } from "react";
import PlayIcon from "@/assets/icon/PlayIcon.svg";
import PauseIcon from "@/assets/icon/PauseIcon.svg";
import RefreshIcon from "@/assets/icon/ResetIcon.svg";
import Spinner from "@/component/Spinner";
import { splitMp3ByDuration, standardizeToMP3 } from "@/utils/audioPreprocessing";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { useUserStore } from "@/store/useUserStore";
import { fetchOnboardingStatus } from "@/lib/onboarding";
import toast from "react-hot-toast";
import IdRejectedPopup from "@/component/IdRejectedPopup";
import { postMetadata } from "@/lib/metadata";
import NoSleep from "nosleep.js";
import FocusModeOverlay from "@/component/FocusModeOverlay";

const DEFAULT_SECONDS = 12 * 60; // 12분
const MIN_SECONDS = 2.5 * 60; // 최소 2.5분
const MAX_SECONDS = 20 * 60; // 최대 20분
const STEP_SECONDS = 30; // 30초 단위
const INITIAL_READY_SECONDS = 60; // 준비 시간 60초

// 음성 알림 파일 경로
const AUDIO_ALERTS = {
    before: "/audio/exam-before.mp3",
    start: "/audio/exam-start.mp3",
    twoMin: "/audio/two-min-left.mp3",
    end: "/audio/exam-end.mp3",
} as const;

// 오디오 프리로드 캐시
const audioCache = new Map<string, HTMLAudioElement>();

function preloadAlerts() {
    if (typeof window === "undefined") return;
    for (const src of Object.values(AUDIO_ALERTS)) {
        if (!audioCache.has(src)) {
            const audio = new Audio(src);
            audio.preload = "auto";
            audioCache.set(src, audio);
        }
    }
}

// 오디오 재생 함수
function playAlert(type: keyof typeof AUDIO_ALERTS) {
    if (typeof window === "undefined") return;
    const src = AUDIO_ALERTS[type];
    const cached = audioCache.get(src);
    if (cached) {
        cached.currentTime = 0;
        cached.play().catch((err) => console.warn("[Audio] 재생 실패:", err));
    } else {
        const audio = new Audio(src);
        audio.play().catch((err) => console.warn("[Audio] 재생 실패:", err));
        audioCache.set(src, audio);
    }
}

type Props = { category: string; caseName: string; checklistId?: string };

export default function RecordCPXClient({ category, caseName, checklistId }: Props) {
    const router = useRouter();

    // 상태값
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [duration, setDuration] = useState(DEFAULT_SECONDS); // 설정된 시험 시간
    const [seconds, setSeconds] = useState(DEFAULT_SECONDS);
    const [volume, setVolume] = useState(0); //볼륨 탐지
    const [audioURL, setAudioURL] = useState<string | null>(null); //녹음된 음성 URL
    const [mp3Blob, setMp3Blob] = useState<Blob | null>(null); //mp3 변환된 파일
    const [isConverting, setIsConverting] = useState(false); //파일 mp3로 전환 중 
    const [isConvertingDirect, setIsConvertingDirect] = useState(false) //바로 전환할 때
    const [isPreviewReady, setIsPreviewReady] = useState(false); //미리듣기 음성 준비 상태
    const [isUploadingToS3, setIsUploadingToS3] = useState(false); //s3로 파일 업로드
    const [isConnecting, setIsConnencting] = useState(false); //세션 연결 상태
    const [readySeconds, setReadySeconds] = useState<number | null>(null); // 준비 시간 타이머
    const [useReadyTimer, setUseReadyTimer] = useState(true); // 준비 시간 토글
    const [focusMode, setFocusMode] = useState(false);
    const [verificationPopup, setVerificationPopup] = useState<{
        kind: "missing" | "rejected";
        reason?: string | null;
    } | null>(null);

    //전역 상태값
    const studentId = useUserStore((s: any) => s.studentId);

    // ref
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const twoMinAlertedRef = useRef(false); // 2분 전 알림 여부
    const endAlertedRef = useRef(false); // 종료 알림 여부
    const noSleepRef = useRef<NoSleep | null>(null);

    // NoSleep 인스턴스 초기화 + 오디오 프리로드
    useEffect(() => {
        noSleepRef.current = new NoSleep();
        preloadAlerts();
        return () => {
            noSleepRef.current?.disable();
        };
    }, []);

    const enableNoSleep = useCallback(() => {
        try {
            noSleepRef.current?.enable();
            console.log("NoSleep 활성화됨 - 화면이 꺼지지 않습니다");
        } catch (err) {
            console.warn("NoSleep 활성화 실패:", err);
        }
    }, []);

    const disableNoSleep = useCallback(() => {
        try {
            noSleepRef.current?.disable();
            console.log("NoSleep 비활성화됨");
        } catch (err) {
            console.warn("NoSleep 비활성화 실패:", err);
        }
    }, []);

    const showTime = useCallback((sec: number) => {
        const mm = Math.floor(sec / 60).toString().padStart(2, "0");
        const ss = (sec % 60).toString().padStart(2, "0");
        return `${mm}:${ss}`;
    }, []);

    //transition관리
    const [isPending, startTransition] = useTransition();


    // 카테고리나 케이스 바뀌면 초기화
    useEffect(() => {
        setIsRecording(false);
        setIsPaused(false);
        setIsFinished(false);
        setSeconds(duration);
        setAudioURL(null);
        setIsPreviewReady(false);
        setMp3Blob(null);
        twoMinAlertedRef.current = false;
        endAlertedRef.current = false;
        audioChunks.current = [];
    }, [category, caseName, duration]);

    // 타이머 로직
    useEffect(() => {
        if (!isRecording || isPaused || isFinished) return;
        const id = setInterval(() => {
            setSeconds((prev) => {
                // 2분 전 알림 (120초)
                if (prev === 121 && !twoMinAlertedRef.current) {
                    twoMinAlertedRef.current = true;
                    playAlert("twoMin");
                }
                // 종료
                if (prev <= 1) {
                    clearInterval(id);
                    stopRecording();
                    setIsFinished(true);
                    if (!endAlertedRef.current) {
                        endAlertedRef.current = true;
                        playAlert("end");
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [isRecording, isPaused, isFinished]);

    // //INITAL TIME 소진시 자동 채점 진행
    // useEffect(() => {
    //     if (seconds === 0 && !isUploadingToS3 && isFinished && !isRecording) {
    //         handleSubmit();
    //     }
    // }, [seconds, isUploadingToS3, isFinished]);

    // 녹음 시작
    async function startRecording() {
        setIsConnencting(true)
        enableNoSleep(); // 화면 꺼짐 방지
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunks.current = [];

            // volume 시각화용 audioContext 세팅
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceRef.current = source;
            dataArrayRef.current = dataArray;

            // 볼륨 업데이트 루프
            const updateVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
                setVolume(avg / 255);
                rafIdRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

            // 녹음 데이터 수집
            mediaRecorder.ondataavailable = (e) => audioChunks.current.push(e.data);
            mediaRecorder.onstop = () => {
                cancelAnimationFrame(rafIdRef.current!);
                setIsFinished(true);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setIsPaused(false);
            setIsPreviewReady(false);
            setIsConnencting(false);
            setFocusMode(true);
            twoMinAlertedRef.current = false;
            endAlertedRef.current = false;

            // 시험 시작 음성 알림
            playAlert("start");
        } catch (err) {
            alert("마이크 접근이 거부되었거나 오류가 발생했습니다.");
            setIsConnencting(false);
            disableNoSleep();
            console.error(err);
        }
    }

    // ⏸ 일시정지
    function pauseRecording() {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "recording") {
            recorder.requestData();
            recorder.pause();
            setIsPaused(true);
            setIsRecording(false);
        }
    }

    // ▶️ 재개
    function resumeRecording() {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "paused") {
            recorder.resume();
            setIsPaused(false);
            setIsRecording(true);
        }
    }

    // ⏹ 완전 중지
    function stopRecording() {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") recorder.stop();
        setIsRecording(false);
        setIsPaused(false);

        analyserRef.current?.disconnect();
        sourceRef.current?.disconnect();

        const audioCtx = audioContextRef.current;
        if (audioCtx && audioCtx.state !== "closed") {
            audioCtx.close();
        }

        disableNoSleep(); // 화면 꺼짐 방지 해제
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

    // 준비 타이머 카운트다운
    useEffect(() => {
        if (readySeconds === null) return;

        if (readySeconds > 0) {
            const id = setInterval(() => {
                setReadySeconds((prev) => (prev !== null ? prev - 1 : null));
            }, 1000);
            return () => clearInterval(id);
        } else if (readySeconds === 0) {
            setReadySeconds(null);
            startRecording();
        }
    }, [readySeconds]);

    // 실습 종료 시 자동 집중 모드 해제
    useEffect(() => {
        if (isFinished) setFocusMode(false);
    }, [isFinished]);

    // 토글
    const toggleRecording = async () => {
        if (isFinished) return;

        // 준비 카운트다운 중 플레이 버튼 클릭 → 즉시 시작
        if (readySeconds !== null && readySeconds > 0) {
            setReadySeconds(null);
            startRecording();
            return;
        }

        if (!isRecording && !isPaused && seconds === duration) {
            const ok = await ensureOnboarding();
            if (!ok) return;
            if (useReadyTimer) {
                playAlert("before"); // 상황 숙지 시작 음성
                setReadySeconds(INITIAL_READY_SECONDS); // 준비 타이머 시작
            } else {
                startRecording(); // 바로 시작
            }
        } else if (isRecording && !isPaused) {
            pauseRecording();
        } else if (!isRecording && isPaused && seconds !== duration) {
            resumeRecording();
        }
    };

    // 시간 조정 함수
    const adjustDuration = (delta: number) => {
        setDuration((prev) => {
            const next = prev + delta;
            if (next < MIN_SECONDS) return MIN_SECONDS;
            if (next > MAX_SECONDS) return MAX_SECONDS;
            return next;
        });
    };

    // ✅ 녹음 미리듣기 (MP3 변환)
    async function handlePreview() {
        if (audioChunks.current.length === 0) {
            alert("아직 녹음된 음성이 없습니다.");
            return;
        }

        setIsConverting(true);
        try {
            const blob = new Blob(audioChunks.current, { type: "audio/webm" });
            const mp3 = await standardizeToMP3(blob);
            setMp3Blob(mp3);
            const url = URL.createObjectURL(mp3);
            setAudioURL(url);
            setIsPreviewReady(true);
        } catch (err) {
            console.error(err);
            alert("MP3 변환 중 오류가 발생했습니다.");
        } finally {
            setIsConverting(false);
        }
    }

    // 업로드 및 채점 이동 (MP3 변환까지 포함)
    async function handleSubmit() {
        try {
            // 1️⃣ 변환 준비
            let finalMp3: Blob | null = mp3Blob;
            if (!finalMp3) {
                if (audioChunks.current.length === 0) {
                    alert("녹음된 음성이 없습니다. 먼저 녹음을 완료해주세요!");
                    return;
                }

                setIsConvertingDirect(true);
                try {
                    const blob = new Blob(audioChunks.current, { type: "audio/webm" });
                    finalMp3 = await standardizeToMP3(blob);
                    setMp3Blob(finalMp3);
                } catch (err) {
                    console.error(err);
                    alert("MP3 변환 중 오류가 발생했습니다.");
                    setIsConvertingDirect(false);
                    return;
                } finally {
                    setIsConvertingDirect(false);
                }
            }
            const now = new Date();
            const timestamp = `${now.getFullYear()}.` +
                `${String(now.getMonth() + 1).padStart(2, "0")}.` +
                `${String(now.getDate()).padStart(2, "0")}-` +
                `${String(now.getHours()).padStart(2, "0")}:` +
                `${String(now.getMinutes()).padStart(2, "0")}:` +
                `${String(now.getSeconds()).padStart(2, "0")}`;

            // 2️⃣ S3 업로드
            setIsUploadingToS3(true);
            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
            const baseKey = `SP_audio/${studentId}-${timestamp}.mp3`;

            const { parts, partCount } = await splitMp3ByDuration(finalMp3!);

            // 1) S3 키 생성 + S3 업로드 병렬
            const keysAndParts = parts.map((part, i) => ({
                key: partCount === 1 ? baseKey : baseKey.replace(/\.mp3$/i, `-part${i + 1}.mp3`),
                part,
            }));

            await Promise.all(keysAndParts.map(async ({ key, part }) => {
                const uploadUrl = await generateUploadUrl(bucket, key);
                const res = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "audio/mpeg" },
                    body: part,
                });
                if (!res.ok) throw new Error("S3 업로드 실패");
            }));

            const audioKeys = keysAndParts.map(({ key }) => key);

            // 2) 메타데이터: 첫 번째로 sessionId 획득 → 나머지 병렬
            const firstMeta = await postMetadata({
                type: "audio",
                s3Key: audioKeys[0],
                sessionId: null,
                caseName,
                origin: "SP",
                fileName: audioKeys[0].split("/").pop() || undefined,
                contentType: "audio/mpeg",
                sizeBytes: parts[0]?.size,
            });
            let sessionId: string | null = firstMeta.sessionId;

            if (audioKeys.length > 1) {
                await Promise.all(audioKeys.slice(1).map((key, i) =>
                    postMetadata({
                        type: "audio",
                        s3Key: key,
                        sessionId,
                        caseName,
                        origin: "SP",
                        fileName: key.split("/").pop() || undefined,
                        contentType: "audio/mpeg",
                        sizeBytes: parts[i + 1]?.size,
                    })
                ));
            }

            // 3️⃣ 업로드 완료 → 채점 페이지 이동
            startTransition(() => {
                const query = audioKeys.length === 1
                    ? `s3Key=${encodeURIComponent(audioKeys[0])}`
                    : `s3KeyList=${encodeURIComponent(JSON.stringify(audioKeys))}`;
                const sessionParam = sessionId
                    ? `&sessionId=${encodeURIComponent(sessionId)}`
                    : "";
                const checklistParam = checklistId
                    ? `&checklistId=${encodeURIComponent(checklistId)}`
                    : "";
                router.push(
                    `/score?${query}&caseName=${encodeURIComponent(caseName)}&studentNumber=${encodeURIComponent(studentId)}&origin=${encodeURIComponent("SP")}${sessionParam}${checklistParam}`
                );
            });
        } catch (err: any) {
            console.error(err);
            alert(`❌ 업로드 중 오류: ${err.message || "알 수 없는 오류"}`);
        } finally {
            setIsUploadingToS3(false);
        }
    }


    return (
        <>
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
            <div className="flex flex-col">
                <SmallHeader
                    title={`${category} | ${caseName}`}
                    onClick={() => router.push("/record-select")}
                />

                <div className="px-8 flex-1 pt-[20px] pb-[136px] flex flex-col items-center justify-center gap-[12px] relative overflow-hidden">
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
                            disabled={isFinished || isUploadingToS3 || isConvertingDirect || isConverting || isConnecting || (readySeconds !== null && readySeconds <= 0)}
                            className="outline-none relative z-10 cursor-pointer hover:opacity-70
                        transition-transform duration-150 ease-out active:scale-90"
                        >
                            {isRecording ? (
                                <PauseIcon className="w-[180px] h-[180px] text-[#7553FC]" />
                            ) : (
                                <PlayIcon className="w-[180px] h-[180px] text-[#7553FC]" />
                            )}
                        </button>
                    </div>

                    {/* 타이머 */}
                    <div className="font-semibold text-[#7553FC] flex flex-col items-center gap-2">
                        {readySeconds !== null && !isRecording && !isFinished ? (
                            <div className="text-center">
                                <span className="text-[22px]">
                                    {readySeconds}초
                                </span>
                                <span> </span>
                                <span className="font-medium text-[16px]">
                                    후 실습이 시작됩니다.
                                    <br />
                                    준비되었다면 <span className="font-bold">플레이 버튼</span>을 눌러주세요.
                                </span>
                            </div>
                        ) : (
                        <div className="text-[22px] flex gap-3 items-center">
                        {/* 녹음 시작 전: +/- 버튼 표시 */}
                        {!isRecording && !isPaused && seconds === duration && (
                            <button
                                onClick={() => adjustDuration(-STEP_SECONDS)}
                                disabled={duration <= MIN_SECONDS}
                                className="w-9 h-9 rounded-full bg-[#F3F0FF] text-[#7553FC] font-bold text-xl flex items-center justify-center hover:bg-[#E9E2FF] disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                −
                            </button>
                        )}

                        {showTime(seconds)}

                        {/* 녹음 시작 전: +/- 버튼 표시 */}
                        {!isRecording && !isPaused && seconds === duration && (
                            <button
                                onClick={() => adjustDuration(STEP_SECONDS)}
                                disabled={duration >= MAX_SECONDS}
                                className="w-9 h-9 rounded-full bg-[#F3F0FF] text-[#7553FC] font-bold text-xl flex items-center justify-center hover:bg-[#E9E2FF] disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                +
                            </button>
                        )}

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

                        {/* 녹음 중 또는 일시정지: 리셋 버튼 */}
                        {!isRecording && seconds < duration && (
                            <button
                                onClick={() => {
                                    setSeconds(duration);
                                    setIsFinished(false);
                                    setIsRecording(false);
                                    setIsPaused(false);
                                    setAudioURL(null);
                                    setIsPreviewReady(false);
                                    setMp3Blob(null);
                                    twoMinAlertedRef.current = false;
                                    endAlertedRef.current = false;
                                    audioChunks.current = [];
                                }}
                                className="cursor-pointer text-[18px] text-[#7553FC] hover:text-[#5a3df0] active:text-[#4327d9] transition"
                            >
                                <RefreshIcon className="w-[20px] h-[20px] text-[#7553FC] hover:opacity-50" />
                            </button>
                        )}
                        </div>
                        )}

                        {/* 준비 시간 토글 */}
                        {!isRecording && !isPaused && seconds === duration && readySeconds === null && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[16px] font-semibold text-[#7553FC]">상황 숙지 시간</span>
                                <button
                                    type="button"
                                    onClick={() => setUseReadyTimer((v) => !v)}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useReadyTimer ? "bg-[#7553FC]" : "bg-gray-300"}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${useReadyTimer ? "translate-x-5" : "translate-x-0"}`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* "녹음된 음성 확인하기" */}
                    {(isPaused || isFinished) && !isPreviewReady && (
                        <button
                            onClick={handlePreview}
                            className="flex gap-2 items-center justify-center px-6 py-3 bg-[#7553FC] text-white rounded-xl hover:opacity-90 transition"
                        >
                            <span className="text-[16px] font-medium">녹음된 음성 확인하기</span>
                            {isConverting && <Spinner borderClassName="border-[#7553FC]" size={12} />}
                        </button>
                    )}

                    {isPreviewReady && audioURL && (
                        <audio controls src={audioURL} className="mt-4 w-full z-10" />
                    )}
                </div>

                <BottomFixButton
                    disabled={isRecording || isUploadingToS3 || seconds === duration}
                    onClick={handleSubmit}
                    buttonName={isFinished ? "채점하기" : "종료 및 채점하기"}
                    loading={isConvertingDirect || isPending || isUploadingToS3}
                />
            </div>

            <FocusModeOverlay
                isOpen={focusMode}
                onClose={() => setFocusMode(false)}
                isRecording={isRecording}
                volume={volume}
                onToggleRecording={toggleRecording}
                disabled={isFinished || isUploadingToS3 || isConvertingDirect || isConverting || isConnecting}
            />
        </>
    );
}
