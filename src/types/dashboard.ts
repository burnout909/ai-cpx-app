export interface VirtualPatient {
  id: string;
  title: string;
  description: string;
  solution?: string;
  type: string;
  required: string[];
  properties: {
    meta: {
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
    };
    [key: string]: any;
  };
  history: Record<string, any>;
  additional_history: Record<string, any>;
  physical_exam: string | Record<string, any>;
  final_question?: string | string[];
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
