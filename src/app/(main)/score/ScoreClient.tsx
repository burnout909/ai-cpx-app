'use client';
import BottomFixButton from '@/component/BottomFixButton';
import ReportDetailTable from '@/component/score/ReportDetail';
import ReportSummary from '@/component/score/ReportSummary';
import { useAutoPipeline } from '@/hooks/score/useAutoPipeline';
import { useLiveAutoPipeline } from '@/hooks/score/useLiveAutoPipeline';
import { GradeItem, SectionResult } from '@/types/score';
import { getAllTotals } from '@/utils/score';
import { useEffect, useState, useRef } from 'react';
import NarrativeFeedbackView from '@/component/score/NarrativeFeedbackView';
import Header from '@/component/Header';
import { loadVPSolution } from '@/utils/loadVirtualPatient';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';

marked.setOptions({ async: false });

interface Props {
    s3Key: string;
    transcriptS3Key: string | null;
    caseName: string | null;
    studentNumber: string | null;
    origin: "VP" | "SP";
}

export default function ScoreClient({ s3Key, transcriptS3Key, caseName, studentNumber, origin }: Props) {
    const [statusMessage, setStatusMessage] = useState<string | null>('준비 중');
    const [results, setResults] = useState<SectionResult[]>([]);
    const [gradesBySection, setGradesBySection] = useState<Record<string, GradeItem[]>>({});
    const [activeSection, setActiveSection] = useState<string>('history');
    const [narrativeFeedback, setNarrativeFeedback] = useState<any | null>(null);
    const [feedbackDone, setFeedbackDone] = useState<boolean>(false);

    // 👇 새로 추가: 솔루션 마크다운/HTML 상태
    const [solutionHtml, setSolutionHtml] = useState<string>("");
    const [showSolution, setShowSolution] = useState<boolean>(true); //솔루션 보기 여부

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const feedbackAnchorRef = useRef<HTMLDivElement>(null);
    const solutionAnchorRef = useRef<HTMLDivElement>(null); // 👈 해설 섹션 상단 ref 추가

    const runAutoPipeline = useAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection, setNarrativeFeedback, setFeedbackDone);
    const runLiveAutoPipeline = useLiveAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection, setNarrativeFeedback, setFeedbackDone);

    useEffect(() => {
        if (!caseName) return;
        if (transcriptS3Key) runLiveAutoPipeline(transcriptS3Key, caseName);
        else if (s3Key) runAutoPipeline(s3Key, caseName);
    }, [s3Key, transcriptS3Key, caseName]);

    // 👇 비동기 로드: caseName 바뀌면 솔루션 로드
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!caseName) {
                    setSolutionHtml("");
                    return;
                }
                const md = await loadVPSolution(caseName);     // ← Promise<string> 대기
                const parsed = marked.parse(md) as string;
                const safe = DOMPurify.sanitize(parsed);
                if (!cancelled) setSolutionHtml(safe);
            } catch (err) {
                if (!cancelled) setSolutionHtml(""); // 실패 시 비움
                console.error(err);
            }
        })();
        return () => { cancelled = true; };
    }, [caseName]);

    const { totals, overall } = getAllTotals(gradesBySection);
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

    // 상태 변화 감시: statusMessage가 null로 바뀌면 토스트 띄우기
    useEffect(() => {
        if (statusMessage === null) {
            const toastId = toast.success(`채점이 완료되었습니다!\n아래 버튼을 눌러 확인해보세요.`, {
                position: 'top-center', // 버튼 위 중앙에 표시
                duration: Infinity,     // 직접 닫을 것이므로 자동 닫힘 X
            });

            // 👇 1초 후에 자동으로 닫기
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
                {!!solutionHtml && (
                    <div className='pt-2'>
                        <h2 className='text-[20px] font-semibold mb-2'>해설</h2>
                        <div
                            className="prose prose-[14px] text-[#333] leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: solutionHtml }}
                        />
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

                <div className='my-2 h-[1.5px] bg-[#333333] w-full'/>
                {/* 피드백 뷰 */}
                {feedbackDone && (
                    <div>
                        <NarrativeFeedbackView studentNumber={studentNumber as string} feedback={narrativeFeedback} origin={origin} />
                        <ReportSummary
                            totals={totals}
                            overall={overall}
                            active={activeSection}
                            setActive={setActiveSection}
                            PART_LABEL={PART_LABEL}
                        />
                        <ReportDetailTable grades={gradesBySection[activeSection]} />
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
