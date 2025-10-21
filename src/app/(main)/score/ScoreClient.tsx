'use client';
import BottomFixButton from '@/component/BottomFixButton';
import ReportDetailTable from '@/component/score/ReportDetail';
import ReportSummary from '@/component/score/ReportSummary';
import { useAutoPipeline } from '@/hooks/score/useAutoPipeline';
import { useLiveAutoPipeline } from '@/hooks/score/useLiveAutoPipeline';
import { GradeItem, SectionResult } from '@/types/score';
import { getAllTotals } from '@/utils/score';
import { useEffect, useState } from 'react';
import NarrativeFeedbackView from '@/component/score/NarrativeFeedbackView';
import ReportModal from '@/component/score/ReportModal';

interface Props {
    s3Key: string;
    transcriptS3Key: string | null;
    caseName: string | null;
}

export default function ScoreClient({ s3Key, transcriptS3Key, caseName }: Props) {
    const [statusMessage, setStatusMessage] = useState<string | null>('준비 중');
    const [results, setResults] = useState<SectionResult[]>([]);
    const [gradesBySection, setGradesBySection] = useState<Record<string, GradeItem[]>>({});
    const [activeSection, setActiveSection] = useState<string>('history');
    const [narrativeFeedback, setNarrativeFeedback] = useState<any | null>(null);
    const [showReport, setShowReport] = useState(false);

    const runAutoPipeline = useAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection, setNarrativeFeedback);
    const runLiveAutoPipeline = useLiveAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection);

    useEffect(() => {
        if (!caseName) return;
        if (transcriptS3Key) runLiveAutoPipeline(transcriptS3Key, caseName);
        else if (s3Key) runAutoPipeline(s3Key, caseName);
    }, [s3Key, transcriptS3Key, caseName]);

    const { totals, overall } = getAllTotals(gradesBySection);
    const PART_LABEL = { history: 'History', physical_exam: 'Physical Exam', education: 'Education', ppi: 'PPI' };

    /** grade 데이터가 준비되었는지 확인 */
    const isGradeReady = Object.keys(gradesBySection).length > 0;

    /** 버튼 클릭 핸들러 */
    const handleButtonClick = () => {
        if (!showReport) {
            // 상세 보기 버튼
            setShowReport(true);
        } else {
            // Report 저장하기 버튼
            alert('준비중인 기능입니다');
            setShowReport(false);
        }
    };

    return (
        <div className="relative flex flex-col items-center justify-center px-4 pb-[136px]">
            {/* 상태 표시 */}
            {statusMessage && (
                <div className="fixed top-3/7 left-1/2 -translate-x-1/2 text-center text-[20px] font-semibold text-[#7553FC] animate-pulse">
                    {statusMessage}
                </div>
            )}

            {/* 피드백 뷰 */}
            {!showReport && narrativeFeedback && (
                <NarrativeFeedbackView feedback={narrativeFeedback} />
            )}

            {/* 하단 버튼 */}
            <BottomFixButton
                disabled={!!statusMessage || (!showReport && !isGradeReady)}
                onClick={handleButtonClick}
                buttonName={showReport ? 'Report 저장하기' : '상세 Report 보기'}
            />

            {/* 전체 리포트 팝업 */}
            {showReport && (
                <ReportModal onClose={() => setShowReport(false)}>
                    <ReportSummary
                        totals={totals}
                        overall={overall}
                        active={activeSection}
                        setActive={setActiveSection}
                        PART_LABEL={PART_LABEL}
                    />
                    {gradesBySection[activeSection] && (
                        <ReportDetailTable grades={gradesBySection[activeSection]} />
                    )}
                </ReportModal>
            )}
        </div>
    );
}
