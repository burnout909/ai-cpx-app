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
    const [feedbackDone, setFeedbackDone] = useState<boolean>(false);

    const runAutoPipeline = useAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection, setNarrativeFeedback, setFeedbackDone);
    const runLiveAutoPipeline = useLiveAutoPipeline(setStatusMessage, setGradesBySection, setResults, setActiveSection, setNarrativeFeedback, setFeedbackDone);

    useEffect(() => {
        if (!caseName) return;
        if (transcriptS3Key) runLiveAutoPipeline(transcriptS3Key, caseName);
        else if (s3Key) runAutoPipeline(s3Key, caseName);
    }, [s3Key, transcriptS3Key, caseName]);

    const { totals, overall } = getAllTotals(gradesBySection);
    const PART_LABEL = { history: '병력 청취', physical_exam: '신체 진찰', education: '환자 교육', ppi: '환자-의사관계' };

    /** 버튼 클릭 핸들러 */
    const handleButtonClick = () => {

        alert('준비중인 기능입니다');
    }


    return (
        <div className="relative flex flex-col items-center justify-center px-4 pb-[136px]">
            {/* 상태 표시 */}
            {statusMessage && (
                <div className="fixed top-3/7 left-1/2 -translate-x-1/2 text-center text-[20px] font-semibold text-[#7553FC] animate-pulse">
                    {statusMessage}
                </div>
            )}

            {/* 피드백 뷰 */}
            {feedbackDone && (
                <div className='px-4'>
                    <NarrativeFeedbackView feedback={narrativeFeedback} />
                    <ReportSummary
                        totals={totals}
                        overall={overall}
                        active={activeSection}
                        setActive={setActiveSection}
                        PART_LABEL={PART_LABEL} />
                    <ReportDetailTable grades={gradesBySection[activeSection]} />
                </div>

            )}
            {/* 하단 버튼 */}
            <BottomFixButton
                disabled={!!statusMessage}
                onClick={handleButtonClick}
                buttonName={'채점 결과 저장하기'}
            />

        </div>
    );
}
