import {
  HistoryEvidenceChecklist,
  PhysicalexamEvidenceChecklist,
  EducationEvidenceChecklist,
  PpiEvidenceChecklist,
  EvidenceChecklist,
} from "@/assets/evidenceChecklist/baseEvidenceChecklist";
import {
  ChecklistItemState,
  ChecklistJson,
  VirtualPatient,
} from "@/types/dashboard";

const withChecked = (items: EvidenceChecklist[]): ChecklistItemState[] =>
  items.map((item) => ({ ...item, checked: true }));

export const createInitialChecklistJson = (): ChecklistJson => ({
  history: withChecked(HistoryEvidenceChecklist),
  physicalExam: withChecked(PhysicalexamEvidenceChecklist),
  education: withChecked(EducationEvidenceChecklist),
  ppi: withChecked(PpiEvidenceChecklist),
});

export const createInitialScenarioJson = (): VirtualPatient => ({
  id: "default_001",
  title: "",
  description: "기본 값으로 생성된 가상환자 시나리오입니다.",
  solution: "",
  type: "object",
  required: ["meta", "history", "additional_history", "physical_exam", "questions"],
  properties: {
    meta: {
      chief_complaint: "",
      diagnosis: "",
      name: "이춘배",
      mrn: 123456,
      age: 48,
      sex: "남성",
      vitals: {
        bp: "",
        hr: 0,
        rr: 0,
        bt: 0,
      },
      attitude: "약간 불안해 보임",
      hybrid_skill: "없음",
    },
  },
  history: {},
  additional_history: {},
  physical_exam: "",
  final_question: "",
});
