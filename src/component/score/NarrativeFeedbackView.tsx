export default function NarrativeFeedbackView({ feedback }: { feedback: any }) {
    // key → 한글 매핑
    const LABEL_MAP: Record<string, string> = {
        history_taking_feedback: '병력청취',
        physical_exam_feedback: '신체진찰',
        patient_education_feedback: '환자교육',
        ppi_feedback: '환자-의사 관계',
        overall_summary: '종합 피드백',
    };

    return (
        <div className="w-full px-4 pb-4 space-y-5 mt-3">
            <h2 className="text-[22px] font-semibold text-gray-800 mb-3">Feedback</h2>
            {Object.entries(feedback).map(([k, v]) => (
                <div key={k}>
                    <div className="text-[18px] font-medium text-gray-800 mb-1">
                        {LABEL_MAP[k] || k.replace(/_/g, ' ')}
                    </div>
                    <p className="whitespace-pre-line text-[#333] text-[15px] leading-relaxed">
                        {v as string}
                    </p>
                </div>
            ))}
        </div>
    );
}
