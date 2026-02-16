'use client';
import BottomFixButton from '@/component/BottomFixButton';
import ReportDetailTable from '@/component/score/ReportDetail';
import ReportSummary from '@/component/score/ReportSummary';
import { useAutoPipeline } from '@/hooks/score/useAutoPipeline';
import { useLiveAutoPipeline } from '@/hooks/score/useLiveAutoPipeline';
import { GradeItem, SectionResult, SectionTimingMap } from '@/types/score';
import { getAllTotals } from '@/utils/score';
import { useEffect, useState, useRef } from 'react';
import Header from '@/component/Header';
import { loadVPSolution } from '@/utils/loadVirtualPatient';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { generateUploadUrl } from '@/app/api/s3/s3';
import getKSTTimestamp from '@/utils/getKSTTimestamp';
import { postMetadata } from '@/lib/metadata';

marked.setOptions({ async: false });

interface Props {
    audioKeys: string[];
    transcriptS3Key: string | null;
    caseName: string | null;
    studentNumber: string | null;
    origin: "VP" | "SP";
    sessionId: string | null;
    checklistId: string | null;
    timestampsS3Key: string | null;
    scenarioId: string | null;
}

type SectionKey = 'history' | 'physical_exam' | 'education' | 'ppi' | null;

export default function ScoreClient({ audioKeys, transcriptS3Key, caseName, studentNumber, origin, sessionId: initialSessionId, checklistId, timestampsS3Key, scenarioId }: Props) {
    const [statusMessage, setStatusMessage] = useState<string | null>('준비 중');
    const [results, setResults] = useState<SectionResult[]>([]);
    const [gradesBySection, setGradesBySection] = useState<Record<string, GradeItem[]>>({});
    const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
    const [done, setDone] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
    const [timingBySection, setTimingBySection] = useState<SectionTimingMap>({});

    // 새로 추가: 솔루션 마크다운/HTML 상태
    const [solutionHtml, setSolutionHtml] = useState<string>("");
    const [solutionLoading, setSolutionLoading] = useState<boolean>(false);
    const [showSolution, setShowSolution] = useState<boolean>(true); //솔루션 보기 여부

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const feedbackAnchorRef = useRef<HTMLDivElement>(null);
    const solutionAnchorRef = useRef<HTMLDivElement>(null); // 해설 섹션 상단 ref 추가
    const uploadedScoreRef = useRef(false);
    const pipelineRanRef = useRef(false);
    const { totals, overall } = getAllTotals(gradesBySection);

    // 구조화 점수 자동 업로드: structuredScore/studentId-datetimeStamp(korea)
    useEffect(() => {
        (async () => {
            try {
                if (uploadedScoreRef.current) return;                  // 중복 방지
                if (!studentNumber) return;
                // 섹션 점수 들어왔는지 확인
                const hasScores = gradesBySection && Object.keys(gradesBySection).length > 0;
                if (!hasScores) return;
                if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME) return;

                uploadedScoreRef.current = true;

                const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
                const timestamp = getKSTTimestamp();
                const key = `${origin}_structuredScore/${studentNumber}-${timestamp}.json`;

                const uploadUrl = await generateUploadUrl(bucket, key);
                const uploadPayload = {
                    ...gradesBySection,
                    ...(Object.keys(timingBySection).length > 0 ? { timingBySection } : {}),
                };
                const body = new Blob([JSON.stringify(uploadPayload, null, 2)], {
                    type: 'application/json; charset=utf-8',
                });

                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body,
                });
                if (uploadRes.ok) {
                    const total = Number.isFinite(overall?.got) ? overall.got : undefined;
                    const meta = await postMetadata({
                        type: "score",
                        s3Key: key,
                        sessionId,
                        caseName,
                        origin,
                        total,
                        sizeBytes: body.size,
                        textLength: JSON.stringify(gradesBySection).length,
                        dataJson: {
                        ...gradesBySection,
                        ...(Object.keys(timingBySection).length > 0 ? { timingBySection } : {}),
                    },
                    });
                    if (meta.sessionId && meta.sessionId !== sessionId) {
                        setSessionId(meta.sessionId);
                    }
                }
            } catch (e) {
                console.warn('[structuredScore upload skipped]', e);
            }
        })();
        // gradesBySection이 채워지는 시점에 1회 시도
    }, [gradesBySection, studentNumber, caseName, origin, sessionId, timingBySection]);




    const runAutoPipeline = useAutoPipeline(
        setStatusMessage,
        setGradesBySection,
        setResults,
        setActiveSection,
        setDone,
        (id) => setSessionId(id),
        setTimingBySection,
    );
    const runLiveAutoPipeline = useLiveAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection, setDone, setTimingBySection);

    useEffect(() => {
        if (!caseName) return;
        if (pipelineRanRef.current) return; // 중복 실행 방지
        pipelineRanRef.current = true;

        (async () => {
            // 1) sessionId가 있으면 DB에서 기존 Score 확인
            if (sessionId) {
                try {
                    const res = await fetch(`/api/metadata?sessionId=${encodeURIComponent(sessionId)}`);
                    if (res.ok) {
                        const { sessions } = await res.json();
                        const session = sessions?.[0];

                        // Score가 있으면 즉시 복원, 파이프라인 건너뛰기
                        const cachedScore = session?.scores?.[0];
                        if (cachedScore?.dataJson && typeof cachedScore.dataJson === 'object') {
                            const { timingBySection: cachedTiming, ...grades } = cachedScore.dataJson as Record<string, unknown>;
                            setGradesBySection(grades as Record<string, GradeItem[]>);
                            setTimingBySection((cachedTiming as SectionTimingMap) ?? {});
                            uploadedScoreRef.current = true; // 재업로드 방지
                            setDone(true);
                            setStatusMessage(null);
                            return;
                        }

                        // Score 없지만 Transcript 있으면 SP 전사 건너뛰기 가능
                        const cachedTranscript = session?.transcripts?.[0];
                        if (cachedTranscript?.s3Key && audioKeys.length > 0) {
                            runAutoPipeline(audioKeys, caseName, sessionId, origin, checklistId, scenarioId, cachedTranscript.s3Key);
                            return;
                        }
                    }
                } catch {
                    // cache check failed, fall through to full pipeline
                }
            }

            // 2) 캐시 없으면 기존 파이프라인 실행
            if (transcriptS3Key) runLiveAutoPipeline(transcriptS3Key, caseName, checklistId, timestampsS3Key, scenarioId);
            else if (audioKeys.length > 0) runAutoPipeline(audioKeys, caseName, sessionId, origin, checklistId, scenarioId);
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseName, sessionId]);

    // 👇 비동기 로드: scenarioId가 있으면 DB에서, 없으면 정적 파일에서 솔루션 로드
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!caseName) {
                    setSolutionHtml("");
                    return;
                }
                setSolutionLoading(true);

                // scenarioId가 있으면 DB에서 commentary 로드
                if (scenarioId) {
                    const res = await fetch(`/api/scenario-commentary?id=${encodeURIComponent(scenarioId)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.html && !cancelled) {
                            setSolutionHtml(DOMPurify.sanitize(data.html));
                            return;
                        }
                    }
                    // DB 조회 실패 시 정적 파일 fallback
                }

                const md = await loadVPSolution(caseName);
                const parsed = marked.parse(md) as string;
                const safe = DOMPurify.sanitize(parsed);
                if (!cancelled) setSolutionHtml(safe);
            } catch (err) {
                if (!cancelled) setSolutionHtml(""); // 실패 시 비움
                console.error(err);
            } finally {
                if (!cancelled) setSolutionLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [caseName, scenarioId]);

    const PART_LABEL = { history: '병력 청취', physical_exam: '신체 진찰', education: '환자 교육', ppi: '환자-의사관계' };

    const handleButtonClick = () => {
        // 👇 버튼을 눌렀을 때만 스크롤 이동
        setShowSolution((prev) => !prev);
        showSolution ?
            setTimeout(() => {
                feedbackAnchorRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }, 150) // DOM 렌더링 보정용 약간의 지연:
            :
            setTimeout(() => {
                solutionAnchorRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }, 150);


    };

    // 상태 변화 감시: statusMessage가 null로 바뀌면 토스트 + 알림음
    useEffect(() => {
        if (statusMessage === null) {
            // 띵 알림음 재생 (도→미 2음 차임)
            try {
                const ctx = new AudioContext();
                const t = ctx.currentTime;
                [1047, 1319].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    const start = t + i * 0.2;
                    gain.gain.setValueAtTime(0.4, start);
                    gain.gain.exponentialRampToValueAtTime(0.01, start + 1.0);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(start);
                    osc.stop(start + 1.0);
                });
            } catch {}

            const toastId = toast.success(`채점이 완료되었습니다!\n아래 버튼을 눌러 확인해보세요.`, {
                position: 'top-center',
                duration: Infinity,
            });

            setTimeout(() => {
                toast.dismiss(toastId);
            }, 5000);
        }
    }, [statusMessage]);
    return (
        <>
            <Header />
            <div className="relative flex flex-col items-center justify-center px-4 pb-[136px] overflow-y-auto"
                ref={scrollContainerRef}
            >
                <div ref={solutionAnchorRef} />
                {/* 상태 표시 + 솔루션 뷰 */}
                {origin == "VP" && (solutionLoading || !!solutionHtml) && (
                    <div className='pt-2 flex flex-col flex-1 w-full'>
                        <h2 className='text-[20px] font-semibold mb-2'>해설</h2>
                        {solutionLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-[#7553FC] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div
                                className="prose prose-[14px] text-[#333] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: solutionHtml }}
                            />
                        )}
                    </div>
                )}
                {/* {statusMessage && (
                    <>
                        <div className="fixed top-3/7 left-1/2 -translate-x-1/2 text-center text-[20px] font-semibold text-[#7553FC] animate-pulse">
                            {statusMessage}
                        </div>
                    </>
                )} */}
                <div ref={feedbackAnchorRef} className="w-full" />

                {/* 피드백 뷰 */}
                {done && (

                    <div className='mt-3 w-full'>
                        <div className="mb-1">
                            <h2 className="text-[22px] font-semibold text-[#7553FC]">실습 피드백</h2>
                        </div>
                        <ReportSummary
                            totals={totals}
                            overall={overall}
                            active={activeSection}
                            setActive={setActiveSection}
                            PART_LABEL={PART_LABEL}
                            timing={timingBySection}
                        />
                        <ReportDetailTable grades={activeSection ? gradesBySection[activeSection] : []} />
                    </div>
                )}

                {/* 하단 버튼 */}
                <BottomFixButton
                    disabled={!!statusMessage}
                    onClick={handleButtonClick}
                    buttonName={statusMessage && statusMessage?.length >= 0 ? statusMessage : showSolution ? '채점결과 보기' : '해설 보기'}
                />
            </div>
        </>
    );
}
