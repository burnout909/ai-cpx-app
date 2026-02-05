"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import SmallHeader from "@/component/SmallHeader";
import BottomFixButton from "@/component/BottomFixButton";
import { standardizeToMP3 } from "@/utils/audioPreprocessing";
import buildPatientInstructions from "@/app/(main)/live-select/cpx/buildPrompt";
import { loadVPProfile } from "@/utils/loadVirtualPatient";
import Image, { StaticImageData } from "next/image";
import PlayIcon from "@/assets/icon/PlayIcon.svg";
import PauseIcon from "@/assets/icon/PauseIcon.svg";
import StopIcon from "@/assets/icon/StopIcon.svg";
import FallbackProfile from "@/assets/virtualPatient/acute_abdominal_pain_001.png";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { VirtualPatient } from "@/types/dashboard";

type Props = {
  category: string;
  caseName: string;
  variant?: "page" | "panel";
  virtualPatient?: VirtualPatient;
  onLockChange?: (locked: boolean) => void;
  patientImageUrl?: string;
};

const INITIAL_SECONDS = 12 * 60;
const INITIAL_READY_SECONDS = 60;

const formatTemp = (t: number) => `${t.toFixed(1)}°C`;

export default function LiveCPXClient({
  category,
  caseName,
  variant = "page",
  virtualPatient,
  onLockChange,
  patientImageUrl,
}: Props) {
  const isPanel = variant === "panel";

  const [isExpanded, setIsExpanded] = useState(!isPanel);
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [seconds, setSeconds] = useState<number>(INITIAL_SECONDS);
  const [isFinished, setIsFinished] = useState(false);
  const [readySeconds, setReadySeconds] = useState<number | null>(null);
  const [conversationText, setConversationText] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState<StaticImageData | string>(FallbackProfile);
  const [caseData, setCaseData] = useState<VirtualPatient | null>(
    virtualPatient ?? null
  );
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [showMicPermissionGuide, setShowMicPermissionGuide] = useState(false);

  useEffect(() => {
    const locked = connected || isRecording || isUploading;
    onLockChange?.(locked);
  }, [connected, isRecording, isUploading, onLockChange]);

  const sessionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const userAudioChunks = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  const stopAndResetSession = useCallback(async () => {
    try {
      if (sessionRef.current) {
        await (sessionRef.current as any).close?.();
        sessionRef.current = null;
      }
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      userAudioChunks.current = [];
      cancelAnimationFrame(rafRef.current!);

      setIsRecording(false);
      setConnected(false);
      setIsUploading(false);
      setIsFinished(false);
      setVolume(0);
      setSeconds(INITIAL_SECONDS);
      setConversationText([]);
    } catch (err) {
      console.warn("세션 종료 중 오류:", err);
    }
  }, []);

  useEffect(() => {
    if (virtualPatient) {
      setCaseData(virtualPatient);
    }
  }, [virtualPatient]);

  useEffect(() => {
    let mounted = true;

    // Priority 1: Use patientImageUrl if provided (AI-generated image)
    if (patientImageUrl) {
      setProfileImage(patientImageUrl);
      return;
    }

    // Priority 2: Load static profile image by caseName
    if (!caseName) {
      setProfileImage(FallbackProfile);
      return;
    }

    (async () => {
      try {
        const img = await loadVPProfile(caseName);
        if (mounted) setProfileImage(img);
      } catch (e) {
        console.warn("프로필 이미지 로드 실패:", e);
        if (mounted) setProfileImage(FallbackProfile);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [caseName, patientImageUrl]);

  useEffect(() => {
    return () => {
      stopAndResetSession();
    };
  }, [stopAndResetSession]);

  useEffect(() => {
    let isMounted = true;

    async function fetchCaseData() {
      try {
        if (virtualPatient) {
          setCaseData(virtualPatient);
        }
      } catch (err) {
        console.error("가상환자 로드 실패:", err);
      }
    }

    if (caseName || virtualPatient) fetchCaseData();

    return () => {
      isMounted = false;
    };
  }, [caseName, virtualPatient]);

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

  useEffect(() => {
    setIsRecording(false);
    setIsFinished(false);
    setSeconds(INITIAL_SECONDS);
  }, [category, caseName]);

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

  useEffect(() => {
    if (seconds === 0 && !isUploading && isFinished && !isRecording) {
      stopSession();
    }
  }, [seconds, isUploading, isFinished, isRecording]);

  async function startSession() {
    if (sessionRef.current || connected || isRecording || isUploading) return;
    setConnected(true);

    if (!caseData) {
      alert("가상환자 데이터가 준비되지 않았어요.");
      setConnected(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusMessage("이 브라우저에서는 마이크를 사용할 수 없어요.");
      setConnected(false);
      return;
    }

    try {
      // 1. 마이크 권한 요청
      let stream: MediaStream;
      try {
        // 보안 컨텍스트 확인
        console.log("Secure context:", window.isSecureContext);
        console.log("mediaDevices available:", !!navigator.mediaDevices);

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("마이크 스트림 획득 성공:", stream.getAudioTracks());
      } catch (micErr: any) {
        console.error("마이크 접근 오류:", micErr.name, micErr.message);
        setConnected(false);

        if (micErr.name === "NotAllowedError") {
          // 권한 차단된 경우 가이드 모달 표시
          setShowMicPermissionGuide(true);
          return;
        }

        let errorMsg = "마이크 접근이 거부되었습니다.";
        if (micErr.name === "NotFoundError") {
          errorMsg = "마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.";
        } else if (micErr.name === "NotReadableError") {
          errorMsg = "마이크가 다른 프로그램에서 사용 중입니다.";
        } else if (micErr.name === "OverconstrainedError") {
          errorMsg = "마이크 설정 오류입니다.";
        } else if (!window.isSecureContext) {
          errorMsg = "HTTPS가 아닌 환경에서는 마이크를 사용할 수 없습니다.";
        }

        setStatusMessage(errorMsg);
        return;
      }

      const audioCtx = new AudioContext();
      const micSrc = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      micSrc.connect(analyser);
      updateVolume(analyser);

      // 2. Realtime API 키 가져오기
      const res = await fetch("/api/realtime-key");
      const keyData = await res.json();

      if (!res.ok || !keyData.value) {
        console.error("API 키 획득 실패:", keyData);
        setStatusMessage("API 키를 가져올 수 없습니다.");
        setConnected(false);
        return;
      }

      const { value } = keyData;

      // 3. 시나리오 데이터 확인
      console.log("시나리오 데이터:", {
        name: caseData?.properties?.meta?.name,
        sex: caseData?.properties?.meta?.sex,
        age: caseData?.properties?.meta?.age,
        chief_complaint: caseData?.properties?.meta?.chief_complaint,
      });

      // 새 스키마(meta at root) 또는 구 스키마(properties.meta) 모두 지원
      const patientSex = caseData?.meta?.sex || caseData?.properties?.meta?.sex;
      const agent = new RealtimeAgent({
        name: "표준화 환자 AI",
        instructions: buildPatientInstructions(caseData),
        voice: patientSex === "남성" ? "ash" : "coral",
      });

      const session: any = new RealtimeSession(agent, {
        model: "gpt-realtime-2025-08-28",
        historyStoreAudio: false,
      });
      sessionRef.current = session;

      // 4. 세션 연결
      await session.connect({
        apiKey: value,
        speed: 1.5,
        prewarm: true,
        eagerness: "high", // 빠른 응답 시작
        turnDetection: {
          type: "client_vad",
          silence_duration_ms: 0,
          autoStart: false,
          prefix_padding_ms: 80,
          min_duration_ms: 250,
        },
      });
      session.on("history_updated", (history: any[]) => {
        const parsed = history
          .filter((h) => h.type === "message" && Array.isArray(h.content))
          .map((h) => {
            const textItem = h.content.find((c: any) => c.transcript || c.text);
            const text = textItem?.transcript || textItem?.text || "";
            if (h.role === "user") return `의사: ${text}`;
            if (h.role === "assistant") return `환자: ${text}`;
            return text;
          })
          .filter((line) => line && line.trim().length > 0);

        setConversationText(parsed);
      });

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          userAudioChunks.current.push(e.data);
          const buf = await e.data.arrayBuffer();
          if ((sessionRef.current as any).input_audio_buffer) {
            (sessionRef.current as any).input_audio_buffer.append(buf);
          }
        }
      };

      recorder.start(100); // 100ms마다 chunk 생성
      setIsRecording(true);
    } catch (err: any) {
      console.error("세션 시작 오류:", err);
      setConnected(false);
      setStatusMessage(`세션 연결 실패: ${err?.message || "알 수 없는 오류"}`);
    }
  }

  async function stopSession() {
    const now = new Date();
    const timestamp = `${now.getFullYear()}.` +
      `${String(now.getMonth() + 1).padStart(2, "0")}.` +
      `${String(now.getDate()).padStart(2, "0")}-` +
      `${String(now.getHours()).padStart(2, "0")}:` +
      `${String(now.getMinutes()).padStart(2, "0")}:` +
      `${String(now.getSeconds()).padStart(2, "0")}`;
    const historyKey = `admin_gen_VP_script/${timestamp}.txt`;

    try {
      setIsUploading(true);
      setIsRecording(false);
      setIsFinished(true);

      if (recorderRef.current?.state === "recording") recorderRef.current.stop();

      if (sessionRef.current) {
        await (sessionRef.current as any).close?.();
        sessionRef.current = null;
      }

      const userBlob = new Blob(userAudioChunks.current, { type: "audio/webm" });
      const userMP3 = await standardizeToMP3(userBlob);

      const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

      const userKey = `admin_gen_VP_audio/${timestamp}.mp3`;
      const uploadUrl = await generateUploadUrl(bucket, userKey);

      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/mpeg" },
        body: userMP3,
      });
      if (!res.ok) throw new Error("S3 업로드 실패 (음성)");

      if (conversationText.length > 0) {
        const txtBlob = conversationText.join("\n");
        const uploadHistoryUrl = await generateUploadUrl(bucket, historyKey);

        const histRes = await fetch(uploadHistoryUrl, {
          method: "PUT",
          headers: { "Content-Type": "text/plain" },
          body: txtBlob,
        });
        if (!histRes.ok) throw new Error("S3 업로드 실패 (히스토리)");
      } else {
        console.warn("⚠️ 대화 내용이 비어 있어 히스토리를 업로드하지 않았습니다.");
      }
    } catch (err) {
      console.error("업로드 중 오류:", err);
      alert("업로드 실패");
    } finally {
      cancelAnimationFrame(rafRef.current!);
      setIsRecording(false);
      setConnected(false);
      setIsUploading(false);
      setIsFinished(false);
      setSeconds(INITIAL_SECONDS);
      setConversationText([]);
      userAudioChunks.current = [];
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

  const handlePlayClick = () => {
    toggleRecording();
  };

  const vitalData = caseData?.meta?.vitals || caseData?.properties?.meta?.vitals;

  const showTime = useCallback((sec: number) => {
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(undefined), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (readySeconds === null) return;

    if (readySeconds > 0) {
      const id = setInterval(() => {
        setReadySeconds((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearInterval(id);
    } else if (readySeconds === 0) {
      startSession();
      setReadySeconds(null);
    }
  }, [readySeconds]);

  const displayCaseName =
    caseName || caseData?.properties?.meta?.name || caseData?.title || "Custom Case";
  const displayCategory = category || "Live CPX";
  const displayPatientName = caseData?.properties?.meta?.name || displayCaseName;
  const displayPatientMeta = [
    caseData?.properties?.meta?.sex,
    caseData?.properties?.meta?.age ? `${caseData?.properties?.meta?.age}세` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  const sidePadding = isPanel ? "px-4" : "px-6";
  const widePadding = isPanel ? "px-4" : "px-8";
  const bottomPadding = isPanel ? "pb-4" : "pb-[136px]";
  const isCollapsed = isPanel && !isExpanded;
  const panelPositionClass = isPanel
    ? `fixed left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 ease-out ${
        isExpanded
          ? "top-[72px] w-[450px] max-w-[92vw] h-[min(80vh,860px)]"
          : "top-2 w-[280px] lg:w-[340px]"
      }`
    : "";
  const panelCardClass = `flex flex-col rounded-2xl border border-[#D8D2F5] bg-white shadow-sm overflow-hidden transition-all duration-300 ease-out ${
    isExpanded ? "h-full" : "h-fit"
  }`;

  const panelBody = (
    <>
      <div className="flex flex-col flex-1 pb-5">
        {isPanel ? (
          <div className="bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-[#210535]">
                  가상환자 테스트
                </div>
                <div className="text-base font-semibold text-[#4A3C85] mt-2">
                  {displayCategory} | {displayCaseName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="rounded-full border border-[#D6D0F4] px-3 py-1.5 text-sm font-semibold text-[#4A3C85] transition-colors hover:bg-[#F3F0FF]"
              >
                접기
              </button>
            </div>
          </div>
        ) : (
          <SmallHeader
            title={`${displayCategory} | ${displayCaseName}`}
            onClick={() => {}}
          />
        )}

        <div className={`${sidePadding} pt-4 w-full flex items-center gap-4`}>
          <div className="w-[56px] h-[56px] relative">
            <Image
              src={profileImage}
              alt="ProfileImage"
              className="overflow-hidden rounded-full object-cover"
              fill
            />
          </div>
          <div className="text-[16px] items-center">
            <p>{caseData?.meta?.name || caseData?.properties?.meta?.name}</p>
            <p className="text-[14px] text-gray-500">
              {caseData?.meta?.sex || caseData?.properties?.meta?.sex}
              {" | "}
              {caseData?.meta?.age || caseData?.properties?.meta?.age}세
            </p>
          </div>
        </div>
        <div className={`${sidePadding} pt-3`}>
          <div className="w-full border-b border-gray-300" />
        </div>

        <div className={`${widePadding} pt-3`}>
          <p className="text-[#210535] text-[16px] leading-relaxed">
            {caseData?.description}
          </p>
        </div>

        <div className={`grid grid-cols-2 gap-y-2 gap-x-2 ${widePadding} pt-3 pb-6`}>
          <div className="flex gap-2">
            <div className="text-[#210535] font-semibold text-[16px]">혈압</div>
            <div className="text-[#210535] text-[16px]">{vitalData?.bp}</div>
          </div>

          <div className="flex gap-2">
            <div className="text-[#210535] font-semibold text-[16px]">맥박</div>
            <div className="text-[#210535] text-[16px]">{vitalData?.hr}</div>
          </div>

          <div className="flex gap-2">
            <div className="text-[#210535] font-semibold text-[16px]">호흡수</div>
            <div className="text-[#210535] text-[16px]">{vitalData?.rr}</div>
          </div>

          <div className="flex gap-2">
            <div className="text-[#210535] font-semibold text-[16px]">체온</div>
            <div className="text-[#210535] text-[16px]">
              {formatTemp(Number(vitalData?.bt))}
            </div>
          </div>
        </div>

        <div
          className={`${widePadding} flex-1 ${bottomPadding} flex flex-col items-center justify-center gap-[12px] relative overflow-hidden`}
        >
          <div className="font-semibold text-[#7553FC] flex gap-2 items-center">
            {readySeconds !== null && !isRecording && !isFinished ? (
              <div className="text-center">
                <span className="text-[22px] ">{readySeconds}초</span>
                <span> </span>
                <span className="font-medium text-[16px]">
                  후 실습이 시작됩니다.
                  <br />
                  준비되었다면 <span className="font-bold">플레이 버튼</span>을 눌러주세요.
                </span>
              </div>
            ) : (
              <span className="text-[22px] ">{showTime(seconds)}</span>
            )}
          </div>
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
              onClick={handlePlayClick}
              className="outline-none relative cursor-pointer hover:opacity-70 transition-transform duration-150 ease-out active:scale-90"
              disabled={isUploading || connected || isFinished}
            >
              {isRecording ? (
                <PauseIcon className="w-[180px] h-[180px] opacity-70" />
              ) : (
                <PlayIcon className="w-[180px] h-[180px]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isPanel ? (
        <div className="px-4 py-3 bg-white">
          <button
            type="button"
            className="w-full rounded-xl bg-[#7553FC] hover:bg-[#6344E5] text-white text-[20px] font-semibold p-4 transition-colors"
            onClick={stopAndResetSession}
          >
            종료
          </button>
        </div>
      ) : (
        <BottomFixButton
          disabled={false}
          buttonName={"종료"}
          onClick={stopAndResetSession}
          loading={false}
        />
      )}
    </>
  );

  // 마이크 권한 가이드 모달
  const micPermissionGuideModal = showMicPermissionGuide && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">마이크 권한이 필요합니다</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          가상환자와 대화하려면 마이크 권한을 허용해야 합니다.
          <br />
          이전에 &quot;차단&quot;을 선택하셨다면 아래 방법으로 해제해주세요.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold flex items-center justify-center">1</span>
            <p className="text-sm text-gray-700">주소창 왼쪽의 <span className="font-semibold">🔒 자물쇠</span> 또는 <span className="font-semibold">ⓘ 아이콘</span>을 클릭하세요</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold flex items-center justify-center">2</span>
            <p className="text-sm text-gray-700"><span className="font-semibold">마이크</span> 항목을 찾아 <span className="font-semibold">&quot;허용&quot;</span>으로 변경하세요</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold flex items-center justify-center">3</span>
            <p className="text-sm text-gray-700">페이지를 <span className="font-semibold">새로고침</span> 한 후 다시 시도하세요</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowMicPermissionGuide(false)}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );

  if (!isPanel) {
    return (
      <div className="flex flex-col min-h-dvh">
        {panelBody}
        {micPermissionGuideModal}
        {statusMessage && (
          <div
            className="fixed bottom-30 left-1/2 -translate-x-1/2 bg-[#c7beeeff] text-[#210535] text-[18px] font-medium px-4 py-3 rounded-xl shadow-lg flex z-[100] animate-slideUpFade flex justify-center items-center w-[calc(100%-40px)]"
          >
            {statusMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {isExpanded && (
        <div className="fixed inset-0 z-[50] bg-black/30 backdrop-blur-[1px]" />
      )}
      <div className={panelPositionClass}>
        <div className={panelCardClass}>
          {isCollapsed ? (
            <div className="flex items-center justify-between gap-3 px-5 py-2">
              <div className="flex items-center gap-3 text-left min-w-0">
                <div className="w-[48px] h-[48px] relative shrink-0">
                  <Image
                    src={profileImage}
                    alt="ProfileImage"
                    className="overflow-hidden rounded-full object-cover"
                    fill
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#210535] truncate">
                    {displayPatientName}
                  </p>
                  <p className="text-[12px] text-[#6F659C]">
                    {displayPatientMeta || " "}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isRecording ? (
                  <button
                    type="button"
                    onClick={() => stopSession()}
                    className="rounded-full p-1.5 text-red-500 transition-colors hover:text-red-600 active:text-red-600"
                    aria-label="종료하기"
                    title="종료하기"
                  >
                    <StopIcon className="w-8 h-8" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlayClick()}
                    className="rounded-full p-1.5 text-gray-500 transition-colors hover:text-[#7553FC] active:text-[#7553FC] disabled:text-gray-300 disabled:cursor-not-allowed"
                    disabled={isUploading || connected}
                    aria-label="재생하기"
                    title="재생하기"
                  >
                    <PlayIcon className="w-8 h-8" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            panelBody
          )}
        </div>
      </div>
      {statusMessage && (
        <div
          className="fixed bottom-30 left-1/2 -translate-x-1/2 bg-[#c7beeeff] text-[#210535] text-[18px] font-medium px-4 py-3 rounded-xl shadow-lg flex z-[100] animate-slideUpFade flex justify-center items-center w-[calc(100%-40px)]"
        >
          {statusMessage}
        </div>
      )}
    </>
  );
}
