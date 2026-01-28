// Physical Exam Item 구조
export interface PhysicalExamItem {
  maneuver: string;
  result: string;
}

// Physical Exam Section 구조
export interface PhysicalExamSection {
  title: string;
  items: PhysicalExamItem[];
}

// Physical Exam 전체 구조 (새 스키마)
export interface PhysicalExamData {
  general?: PhysicalExamSection[];
  heent?: PhysicalExamSection[];
  neck?: PhysicalExamSection[];
  chest_respiratory?: PhysicalExamSection[];
  cardiac?: PhysicalExamSection[];
  abdomen?: PhysicalExamSection[];
  back_flank?: PhysicalExamSection[];
  extremities_upper?: PhysicalExamSection[];
  extremities_lower?: PhysicalExamSection[];
  neurologic_exam?: PhysicalExamSection[];
  skin?: PhysicalExamSection[];
  genitourinary?: PhysicalExamSection[];
  rectal?: PhysicalExamSection[];
  pelvic?: PhysicalExamSection[];
  miscellaneous_pe?: PhysicalExamSection[];
  [key: string]: PhysicalExamSection[] | undefined;
}

// Meta 정보 구조
export interface VirtualPatientMeta {
  chief_complaint: string;
  diagnosis?: string;
  name: string;
  mrn: number;
  age: number;
  sex: string;
  vitals: {
    bp: string;
    hr: number;
    rr: number;
    bt: number;
  };
  attitude: string;
  hybrid_skill: string;
  [key: string]: unknown;
}

export interface VirtualPatient {
  id: string;
  title: string;
  description: string;
  solution?: string;
  type: string;
  required: string[];
  // 새 스키마: meta가 루트에 직접 위치
  meta?: VirtualPatientMeta;
  // 구 스키마: properties.meta 구조 (하위 호환성)
  properties?: {
    meta: VirtualPatientMeta;
    [key: string]: unknown;
  };
  history: Record<string, string[] | string | number | Record<string, string[]>>;
  additional_history: Record<string, string[] | string | Record<string, string[]>>;
  physical_exam: PhysicalExamData | string | Record<string, unknown>;
  questions?: string | string[];
}

export interface EvidenceChecklist {
  id: string;
  title: string;
  criteria: string;
}

export interface ChecklistItemState extends EvidenceChecklist {
  checked: boolean;
}

export interface ChecklistJson {
  history: ChecklistItemState[];
  physicalExam: ChecklistItemState[];
  education: ChecklistItemState[];
  ppi: ChecklistItemState[];
}
