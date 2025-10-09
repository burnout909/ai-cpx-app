'use client';

import BottomFixButton from "@/component/BottomFixButton";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import PlayIcon from "@/assets/icon/PlayIcon.svg";
import PauseIcon from "@/assets/icon/PauseIcon.svg";
import RefreshIcon from "@/assets/icon/ResetIcon.svg";
import Spinner from "@/component/Spinner";
import { standardizeToMP3 } from "@/app/utils/audioPreprocessing";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { v4 as uuidv4 } from "uuid";

const INITIAL_SECONDS = 12 * 60; // 12분

type Props = { category: string; caseName: string };

export default function RecordCPXClient({ category, caseName }: Props) {
    const router = useRouter();

    // 상태값
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [seconds, setSeconds] = useState(INITIAL_SECONDS);
    const [volume, setVolume] = useState(0);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isPreviewReady, setIsPreviewReady] = useState(false);
    const [isUploadingToS3, setIsUploadingToS3] = useState(false);

    // ref
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const showTime = useCallback((sec: number) => {
        const mm = Math.floor(sec / 60).toString().padStart(2, "0");
        const ss = (sec % 60).toString().padStart(2, "0");
        return `${mm}:${ss}`;
    }, []);

    // 카테고리나 케이스 바뀌면 초기화
    useEffect(() => {
        setIsRecording(false);
        setIsPaused(false);
        setIsFinished(false);
        setSeconds(INITIAL_SECONDS);
        setAudioURL(null);
        setIsPreviewReady(false);
        setMp3Blob(null);
        audioChunks.current = [];
    }, [category, caseName]);

    // 타이머 로직
    useEffect(() => {
        if (!isRecording || isPaused || isFinished) return;
        const id = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(id);
                    stopRecording();
                    setIsFinished(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [isRecording, isPaused, isFinished]);

    // 🔴 녹음 시작
    async function startRecording() {
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
        } catch (err) {
            alert("마이크 접근이 거부되었거나 오류가 발생했습니다.");
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
    }

    // 토글
    const toggleRecording = () => {
        if (isFinished) return;
        if (!isRecording && !isPaused && seconds === INITIAL_SECONDS) {
            startRecording();
        } else if (isRecording && !isPaused) {
            pauseRecording();
        } else if (!isRecording && isPaused && seconds !== INITIAL_SECONDS) {
            resumeRecording();
        }
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

    // ✅ 업로드 및 채점 이동
    async function handleSubmit() {
        if (!mp3Blob) {
            alert("먼저 음성을 변환 후 업로드해주세요!");
            return;
        }

        try {
            setIsUploadingToS3(true);

            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
            const key = `uploads/${uuidv4()}.mp3`;

            // Presigned URL 생성
            const uploadUrl = await generateUploadUrl(bucket, key);

            // 업로드 실행
            const res = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "audio/mpeg" },
                body: mp3Blob,
            });

            if (!res.ok) throw new Error("S3 업로드 실패");

            // 업로드 성공 → 채점 페이지로 이동
            router.push(`/score?s3Key=${encodeURIComponent(key)}&caseName=${encodeURIComponent(caseName)}`);
        } catch (err: any) {
            console.error(err);
            alert(`❌ 업로드 중 오류: ${err.message || "알 수 없는 오류"}`);
        } finally {
            setIsUploadingToS3(false);
        }
    }

    return (
        <div className="flex flex-col">
            <SmallHeader
                title={`${category} | ${caseName}`}
                onClick={() => router.push("/record-select")}
            />

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
                        disabled={isFinished}
                        className="outline-none relative z-10 cursor-pointer hover:opacity-70"
                    >
                        {isRecording ? (
                            <PauseIcon className="w-[240px] h-[240px] text-[#7553FC]" />
                        ) : (
                            <PlayIcon className="w-[240px] h-[240px] text-[#7553FC]" />
                        )}
                    </button>
                </div>

                {/* 타이머 */}
                <div className="font-semibold text-[36px] text-[#7553FC] flex gap-2 items-center">
                    {showTime(seconds)}
                    {!isRecording && seconds < INITIAL_SECONDS && (
                        <button
                            onClick={() => {
                                setSeconds(INITIAL_SECONDS);
                                setIsFinished(false);
                                setIsRecording(false);
                                setIsPaused(false);
                                setAudioURL(null);
                                setIsPreviewReady(false);
                                setMp3Blob(null);
                                audioChunks.current = [];
                            }}
                            className="cursor-pointer text-[18px] text-[#7553FC] hover:text-[#5a3df0] active:text-[#4327d9] transition"
                        >
                            <RefreshIcon className="w-[32px] h-[32px] text-[#7553FC] hover:opacity-50" />
                        </button>
                    )}
                </div>

                {/* “녹음된 음성 확인하기” */}
                {(isPaused || isFinished) && !isConverting && !isPreviewReady && (
                    <button
                        onClick={handlePreview}
                        className="mt-4 px-6 py-3 bg-[#7553FC] text-white rounded-xl hover:opacity-90 transition"
                    >
                        녹음된 음성 확인하기
                    </button>
                )}

                {isConverting && (
                    <div className="mt-4">
                        <Spinner borderClassName="border-[#7553FC]" size={40} />
                    </div>
                )}

                {isPreviewReady && audioURL && (
                    <audio controls src={audioURL} className="mt-4 w-full z-10" />
                )}
            </div>

            <BottomFixButton
                disabled={isRecording || isUploadingToS3}
                onClick={handleSubmit}
                buttonName={isFinished ? "채점하기" : "종료 및 채점하기"}
            />
        </div>
    );
}
