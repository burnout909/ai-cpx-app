import DOMPurify from 'dompurify';
import { marked } from "marked";

export default function NarrativeFeedbackView({ feedback, studentNumber, origin }: { feedback: any, studentNumber:string, origin:"VP" | "SP" }) {
  // key → 한글 매핑
  const LABEL_MAP: Record<string, string> = {
    history_taking_feedback: '병력 청취',
    physical_exam_feedback: '신체 진찰',
    patient_education_feedback: '환자 교육',
    ppi_feedback: '환자-의사 관계'
  };

  marked.setOptions({ async: false });

  return (
    <div className="w-full pb-4 space-y-5 mt-3">
      <h2 className="text-[18px] font-semibold text-gray-800 mb-3">{`${studentNumber}님의 실습 피드백 (${origin==="VP"? "가상환자": "SP"})`}</h2>

      {Object.entries(feedback).map(([k, v]) => {
        const markdownText = String(v ?? '');
        const html = DOMPurify.sanitize(marked.parse(markdownText) as string);

        return (
          <div key={k}>
            <div className="text-[16px] font-medium text-gray-800 mb-1">
              {LABEL_MAP[k] || k.replace(/_/g, " ")}
            </div>
            <div
              className="prose prose-sm text-[#333] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        );
      })}
    </div>
  );
}
