import DOMPurify from 'dompurify';
import { marked } from "marked";

export type SectionKey = 'history' | 'physical_exam' | 'education' | 'ppi' | null;

export default function NarrativeFeedbackView({
  feedback,
  studentNumber,
  origin,
  sectionFilter = null,
  hideTitle = false,
}: {
  feedback: any;
  studentNumber: string;
  origin: "VP" | "SP";
  sectionFilter?: SectionKey;
  hideTitle?: boolean;
}) {
  // key → 한글 매핑
  const LABEL_MAP: Record<string, string> = {
    history_taking_feedback: '병력 청취',
    physical_exam_feedback: '신체 진찰',
    patient_education_feedback: '환자 교육',
    ppi_feedback: '환자-의사 관계'
  };

  // 섹션 키 → 피드백 키 매핑
  const SECTION_TO_FEEDBACK: Record<Exclude<SectionKey, null>, string> = {
    history: 'history_taking_feedback',
    physical_exam: 'physical_exam_feedback',
    education: 'patient_education_feedback',
    ppi: 'ppi_feedback',
  };

  marked.setOptions({ async: false });

  const entries = Object.entries(feedback ?? {});
  const filtered = sectionFilter
    ? entries.filter(([k]) => k === SECTION_TO_FEEDBACK[sectionFilter])
    : entries;

  if (filtered.length === 0) return null;

  return (
    <div className={`w-full pb-4 space-y-5 ${hideTitle ? '' : 'mt-3'}`}>
      {!hideTitle && (
        <h2 className="text-[22px] font-semibold text-[#7553FC] mb-2">실습 피드백</h2>
      )}

      {filtered.map(([k, v]) => {
        const markdownText = String(v ?? '');
        const html = DOMPurify.sanitize(marked.parse(markdownText) as string);

        return (
          <div key={k}>
            <div className="text-[16px] font-medium text-gray-800 mb-1">
              {/* {LABEL_MAP[k] || k.replace(/_/g, " ")} */}
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
