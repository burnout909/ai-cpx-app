'use client';
import BottomFixButton from '@/component/BottomFixButton';
import ReportDetailTable from '@/component/score/ReportDetail';
import ReportSummary from '@/component/score/ReportSummary';
import { GradeItem, SectionTimingMap } from '@/types/score';
import { getAllTotals } from '@/utils/score';
import { useEffect, useState, useRef } from 'react';
import Header from '@/component/Header';
import SmallHeader from '@/component/SmallHeader';
import { useRouter } from 'next/navigation';
import { loadVPSolution } from '@/utils/loadVirtualPatient';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';
import { track } from '@/lib/mixpanel';
import { usePageTracking } from '@/hooks/usePageTracking';
import { reportClientError } from '@/lib/reportClientError';

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
    fromHistory?: boolean;
}

type SectionKey = 'history' | 'physical_exam' | 'education' | 'ppi' | null;


export default function ScoreClient({ audioKeys, transcriptS3Key, caseName, origin, sessionId: initialSessionId, checklistId, timestampsS3Key, scenarioId, fromHistory }: Props) {
    const router = useRouter();
    usePageTracking("score", { origin: fromHistory ? "History" : origin });
    const [statusMessage, setStatusMessage] = useState<string | null>('준비 중');
    const [gradesBySection, setGradesBySection] = useState<Record<string, GradeItem[]>>({});
    const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
    const [done, setDone] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
    const [timingBySection, setTimingBySection] = useState<SectionTimingMap>({});

    // Queue stage tracking
    type PipelineStage = "transcribing" | "loading" | "collecting" | "grading" | "saving";
    const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);
    const [showScoringUI, setShowScoringUI] = useState<boolean>(false);
    const [enqueuing, setEnqueuing] = useState<boolean>(false);

    // 새로 추가: 솔루션 마크다운/HTML 상태
    const [solutionHtml, setSolutionHtml] = useState<string>("");
    const [solutionLoading, setSolutionLoading] = useState<boolean>(false);
    const [showSolution, setShowSolution] = useState<boolean>(!fromHistory); // fromHistory면 해설 닫힌 상태로 시작

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const feedbackAnchorRef = useRef<HTMLDivElement>(null);
    const solutionAnchorRef = useRef<HTMLDivElement>(null); // 해설 섹션 상단 ref 추가
    const uploadedScoreRef = useRef(false);
    const scoreStartTimeRef = useRef(Date.now());
    const pipelineRanRef = useRef(false);
    const { totals, overall } = getAllTotals(gradesBySection);

    // Queue 기반 채점: enqueue → polling
    async function enqueueAndPoll(extraParams?: { cachedTranscriptS3Key?: string }) {
        setEnqueuing(true);
        setStatusMessage('채점 대기 중');

        const enqueueBody: Record<string, unknown> = {
            caseName,
            origin,
            sessionId,
            checklistId,
            scenarioId,
        };

        if (origin === "VP" && transcriptS3Key) {
            enqueueBody.transcriptS3Key = transcriptS3Key;
            if (timestampsS3Key) enqueueBody.timestampsS3Key = timestampsS3Key;
        } else {
            enqueueBody.audioKeys = audioKeys;
        }

        if (extraParams?.cachedTranscriptS3Key) {
            enqueueBody.cachedTranscriptS3Key = extraParams.cachedTranscriptS3Key;
        }

        const enqueueRes = await fetch('/api/score/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enqueueBody),
        });
        if (!enqueueRes.ok) {
            const err = await enqueueRes.json().catch(() => ({}));
            throw new Error(err.detail || 'enqueue failed');
        }
        const { jobId } = await enqueueRes.json();

        // Enqueue 성공 → 채점 진행 UI로 전환
        setEnqueuing(false);
        setShowScoringUI(true);

        // Polling loop
        while (true) {
            await new Promise((r) => setTimeout(r, 2000));
            const statusRes = await fetch(`/api/score/status?id=${encodeURIComponent(jobId)}`);
            if (!statusRes.ok) continue;
            const data = await statusRes.json();

            if (data.status === 'waiting') {
                setStatusMessage(`채점 대기 중${data.position ? ` (${data.position}번째)` : ''}`);
            } else if (data.status === 'processing') {
                setStatusMessage('채점 중');
                if (data.stage) setCurrentStage(data.stage);
            } else if (data.status === 'done' && data.result) {
                setCurrentStage('saving');
                setGradesBySection(data.result.gradesBySection);
                setTimingBySection(data.result.timingBySection ?? {});
                uploadedScoreRef.current = true;
                return;
            } else if (data.status === 'failed') {
                throw new Error(data.error || '채점 실패');
            }
        }
    }

    useEffect(() => {
        if (!caseName) return;
        if (pipelineRanRef.current) return;
        pipelineRanRef.current = true;

        (async () => {
            try {
                // Tier 1: sessionId가 있으면 DB에서 기존 Score 확인
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
                                uploadedScoreRef.current = true;
                                setDone(true);
                                setStatusMessage(null);
                                return;
                            }

                            // Tier 2: Score 없지만 Transcript 있으면 cachedTranscriptS3Key 전달
                            const cachedTranscript = session?.transcripts?.[0];
                            if (cachedTranscript?.s3Key) {
                                await enqueueAndPoll({ cachedTranscriptS3Key: cachedTranscript.s3Key });
                                setStatusMessage(null);
                                setDone(true);
                                return;
                            }
                        }
                    } catch {
                        // cache check failed, fall through to full pipeline
                    }
                }

                // Tier 3: 캐시 없음 → queue 채점
                await enqueueAndPoll();
                setStatusMessage(null);
                setDone(true);
            } catch (e: any) {
                reportClientError(e?.message || String(e), { source: "ScoreClient/pipeline", stackTrace: e?.stack });
                setStatusMessage(`오류 발생: ${e.message || e}`);
            }
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

                // scenarioId 또는 caseName으로 DB에서 commentary 로드
                const commentaryUrl = scenarioId
                    ? `/api/scenario-commentary?id=${encodeURIComponent(scenarioId)}`
                    : `/api/scenario-commentary?caseName=${encodeURIComponent(caseName)}`;
                const res = await fetch(commentaryUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data.html && !cancelled) {
                        setSolutionHtml(DOMPurify.sanitize(data.html));
                        return;
                    }
                }
                // DB 조회 실패 시 정적 파일 fallback

                const md = await loadVPSolution(caseName);
                const parsed = marked.parse(md) as string;
                const safe = DOMPurify.sanitize(parsed);
                if (!cancelled) setSolutionHtml(safe);
            } catch (err) {
                if (!cancelled) setSolutionHtml(""); // 실패 시 비움
                reportClientError(err instanceof Error ? err.message : String(err), { source: "ScoreClient/loadSolution", stackTrace: err instanceof Error ? err.stack : undefined });
            } finally {
                if (!cancelled) setSolutionLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [caseName, scenarioId]);

    const PART_LABEL = { history: '병력 청취', physical_exam: '신체 진찰', education: '환자 교육', ppi: '환자-의사관계' };

    const handleButtonClick = () => {
        track("score_navigate_practice", { case_name: caseName, origin });
        if (origin === "VP") {
            router.push('/live-select');
        } else {
            router.push('/record-select');
        }
    };

    // 상태 변화 감시: statusMessage가 null로 바뀌면 토스트 + 알림음
    useEffect(() => {
        if (statusMessage === null && !fromHistory) {
            track("score_completed", {
                case_name: caseName,
                origin,
                session_id: sessionId,
                score_duration_ms: Date.now() - scoreStartTimeRef.current,
            });
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
            {fromHistory ? (
                <SmallHeader title="실습 피드백" onClick={() => router.push('/history')} />
            ) : (
                <Header />
            )}
            <div className={`relative flex flex-col items-center justify-center px-4 overflow-y-auto ${fromHistory ? 'pb-6' : 'pb-[136px]'}`}
                ref={scrollContainerRef}
            >
                {/* Enqueue / 초기 대기 UI — VP: done 전까지, SP: enqueuing 중에만 */}
                {(origin === "VP" ? (!done && !showScoringUI && !fromHistory) : enqueuing) && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
                        <div className="w-8 h-8 border-3 border-[#7553FC] border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-[18px] text-gray-500">잠시 페이지를 벗어나지 말아주세요</p>
                    </div>
                )}

                {/* 채점 진행 중 UI — VP: 인라인 컴포넌트, SP: 전체화면 오버레이 */}
                {showScoringUI && !done && origin === "VP" && (() => {
                    const VP_STEPS: { stage: PipelineStage; label: string }[] = [
                        { stage: 'transcribing', label: '전사 다운로드' },
                        { stage: 'loading', label: '채점 기준 로드' },
                        { stage: 'collecting', label: '증거 수집' },
                        { stage: 'grading', label: '점수 계산' },
                        { stage: 'saving', label: '결과 저장' },
                    ];
                    const stageOrder: PipelineStage[] = VP_STEPS.map(s => s.stage);
                    const currentIdx = currentStage ? stageOrder.indexOf(currentStage) : 0;

                    return (
                        <div className="w-full flex flex-col items-center px-2 pt-4 pb-6 mb-4">
                            <p className="text-[22px] font-bold text-gray-900 mb-2 text-center">
                                채점이 진행되고 있어요.
                            </p>
                            <p className="text-[14px] text-gray-500 text-center mb-6">
                                페이지를 벗어나셔도 학습 기록에서 채점 결과를 확인할 수 있어요.
                            </p>

                            <div className="w-full max-w-xs flex flex-col gap-3">
                                {VP_STEPS.map(({ stage, label }, idx) => {
                                    const isDone = idx < currentIdx;
                                    const isActive = idx === currentIdx;
                                    return (
                                        <div key={stage} className="flex items-center gap-3">
                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors duration-500 ${
                                                isDone ? 'bg-[#7553FC] text-white' :
                                                isActive ? 'bg-[#7553FC] text-white animate-pulse' :
                                                'bg-gray-200 text-gray-400'
                                            }`}>
                                                {isDone ? '✓' : idx + 1}
                                            </div>
                                            <span className={`text-[15px] transition-colors duration-500 ${
                                                isDone ? 'text-[#7553FC] font-semibold' :
                                                isActive ? 'text-[#7553FC] font-semibold' :
                                                'text-gray-300'
                                            }`}>
                                                {label}{isActive && <span className="ml-1 inline-block animate-pulse">...</span>}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                <div ref={solutionAnchorRef} />
                {/* 상태 표시 + 솔루션 뷰 */}
                {origin == "VP" && (solutionLoading || !!solutionHtml) && (
                    <div className='pt-2 flex flex-col flex-1 w-full'>
                        {fromHistory ? (
                            <button
                                onClick={() => setShowSolution((prev) => !prev)}
                                className="flex items-center gap-1.5 mb-2"
                            >
                                <span className={`text-[14px] transition-transform duration-200 ${showSolution ? 'rotate-90' : ''}`}>▶</span>
                                <h2 className='text-[20px] font-semibold'>해설</h2>
                            </button>
                        ) : (
                            <h2 className='text-[20px] font-semibold mb-2'>해설</h2>
                        )}
                        {showSolution && (
                            solutionLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-[#7553FC] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div
                                    className="prose prose-[14px] text-[#333] leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: solutionHtml }}
                                />
                            )
                        )}
                    </div>
                )}

                {showScoringUI && !done && origin === "SP" && (() => {
                    const SP_STEPS: { stage: PipelineStage; label: string }[] = [
                        { stage: 'transcribing', label: '음성 전사' },
                        { stage: 'loading', label: '채점 기준 로드' },
                        { stage: 'collecting', label: '증거 수집' },
                        { stage: 'grading', label: '점수 계산' },
                        { stage: 'saving', label: '결과 저장' },
                    ];
                    const steps = SP_STEPS;
                    const stageOrder: PipelineStage[] = steps.map(s => s.stage);
                    const currentIdx = currentStage ? stageOrder.indexOf(currentStage) : 0;

                    return (
                        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-white">
                            <p className="text-[22px] font-bold text-gray-900 mb-2 text-center">
                                채점이 진행되고 있어요.
                            </p>
                            <p className="text-[18px] text-gray-500 text-center">
                                페이지를 벗어나셔도 학습 기록에서 채점 결과를 확인할 수 있어요.
                            </p>
                            <p className="text-[18px] text-gray-500 mb-8 text-center">
                                바로 다음 실습을 진행하시겠어요?
                            </p>

                            {/* Pipeline steps */}
                            <div className="w-full max-w-xs mb-10 flex flex-col gap-3">
                                {steps.map(({ stage, label }, idx) => {
                                    const isDone = idx < currentIdx;
                                    const isActive = idx === currentIdx;
                                    return (
                                        <div key={stage} className="flex items-center gap-3">
                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors duration-500 ${
                                                isDone ? 'bg-[#7553FC] text-white' :
                                                isActive ? 'bg-[#7553FC] text-white animate-pulse' :
                                                'bg-gray-200 text-gray-400'
                                            }`}>
                                                {isDone ? '✓' : idx + 1}
                                            </div>
                                            <span className={`text-[15px] transition-colors duration-500 ${
                                                isDone ? 'text-[#7553FC] font-semibold' :
                                                isActive ? 'text-[#7553FC] font-semibold' :
                                                'text-gray-300'
                                            }`}>
                                                {label}{isActive && <span className="ml-1 inline-block animate-pulse">...</span>}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Navigation buttons */}
                            <div className="w-full max-w-sm flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        track("score_next_practice_clicked", { case_name: caseName, origin, target: "SP" });
                                        router.push('/record-select');
                                    }}
                                    className="w-full py-3.5 rounded-xl bg-[#7553FC] text-white text-[16px] font-semibold"
                                >
                                    표준화환자와 실습하기
                                </button>
                                <button
                                    onClick={() => {
                                        track("score_next_practice_clicked", { case_name: caseName, origin, target: "VP" });
                                        router.push('/live-select');
                                    }}
                                    className="w-full py-3.5 rounded-xl bg-white text-[#7553FC] text-[16px] font-semibold border border-[#7553FC]"
                                >
                                    가상환자와 실습하기
                                </button>
                            </div>
                        </div>
                    );
                })()}

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
                            origin={origin}
                        />
                        <ReportDetailTable grades={activeSection ? gradesBySection[activeSection] : []} section={activeSection} origin={origin} />
                    </div>
                )}

                {/* 하단 버튼 — fromHistory에서는 숨김 */}
                {!fromHistory && (
                    <BottomFixButton
                        disabled={origin === "VP" ? (!done && !showScoringUI) : !!statusMessage}
                        onClick={handleButtonClick}
                        buttonName={origin === "VP" ? '다른 케이스 연습하기' : (statusMessage && statusMessage?.length >= 0 ? statusMessage : '다른 케이스 연습하기')}
                    />
                )}
            </div>
        </>
    );
}
