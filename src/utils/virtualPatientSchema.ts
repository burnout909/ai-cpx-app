import { z } from "zod";
import { VirtualPatient, PhysicalExamData } from "@/types/dashboard";

const vitalsSchema = z.object({
  bp: z.string(),
  hr: z.number(),
  rr: z.number(),
  bt: z.number(),
});

const metaSchema = z.object({
  chief_complaint: z.string(),
  diagnosis: z.string().optional(),
  name: z.string(),
  mrn: z.number(),
  age: z.number(),
  sex: z.string(),
  vitals: vitalsSchema,
  attitude: z.string(),
  hybrid_skill: z.string(),
}).passthrough();

const physicalExamItemSchema = z.object({
  maneuver: z.string(),
  result: z.string(),
});

const physicalExamSectionSchema = z.object({
  title: z.string(),
  items: z.array(physicalExamItemSchema),
});

const physicalExamSchema = z.record(z.array(physicalExamSectionSchema));

export const virtualPatientOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  solution: z.string().optional(),
  type: z.string(),
  required: z.array(z.string()),
  // 새 스키마: meta가 루트 레벨에 위치
  meta: metaSchema.optional(),
  // 구 스키마 (하위 호환성)
  properties: z.object({
    meta: metaSchema,
  }).passthrough().optional(),
  history: z.record(z.any()),
  additional_history: z.record(z.any()),
  physical_exam: z.union([z.string(), physicalExamSchema, z.record(z.any())]),
  questions: z.union([z.string(), z.array(z.string())]).optional(),
});

export type VirtualPatientParsed = z.infer<typeof virtualPatientOutputSchema>;

// 기본 Physical Exam 템플릿 (새 구조)
const defaultPhysicalExam: PhysicalExamData = {
  general: [{ title: "General appearance", items: [] }],
  heent: [
    { title: "Eyes", items: [] },
    { title: "Oral cavity / tongue", items: [] },
  ],
  neck: [
    { title: "Cervical lymph nodes", items: [] },
    { title: "Thyroid", items: [] },
  ],
  chest_respiratory: [
    { title: "Inspection", items: [] },
    { title: "Palpation", items: [] },
    { title: "Percussion", items: [] },
    { title: "Auscultation", items: [] },
  ],
  cardiac: [{ title: "Auscultation", items: [] }],
  abdomen: [
    { title: "Inspection", items: [] },
    { title: "Auscultation", items: [] },
    { title: "Percussion", items: [] },
    { title: "Palpation", items: [] },
    { title: "Special tests", items: [] },
  ],
  back_flank: [{ title: "CVA tenderness", items: [] }],
  extremities_upper: [{ title: "Screening", items: [] }],
  extremities_lower: [{ title: "Edema", items: [] }],
  neurologic_exam: [{ title: "Consciousness / cranial nerves / motor / sensory", items: [] }],
  skin: [{ title: "Inspection", items: [] }],
  genitourinary: [{ title: "External genital exam", items: [] }],
  rectal: [{ title: "DRE", items: [] }],
  pelvic: [{ title: "Pelvic exam", items: [] }],
  miscellaneous_pe: [{ title: "Other", items: [] }],
};

export const virtualPatientTemplate: VirtualPatient = {
  id: "template_id",
  title: "",
  description: "",
  solution: "",
  type: "object",
  required: ["meta", "history", "additional_history", "physical_exam", "questions"],
  // 새 스키마: meta가 루트에 위치
  meta: {
    chief_complaint: "",
    diagnosis: "",
    name: "",
    mrn: 0,
    age: 0,
    sex: "",
    vitals: {
      bp: "",
      hr: 0,
      rr: 0,
      bt: 0,
    },
    attitude: "",
    hybrid_skill: "",
  },
  // 구 스키마 (하위 호환성)
  properties: {
    meta: {
      chief_complaint: "",
      diagnosis: "",
      name: "",
      mrn: 0,
      age: 0,
      sex: "",
      vitals: {
        bp: "",
        hr: 0,
        rr: 0,
        bt: 0,
      },
      attitude: "",
      hybrid_skill: "",
    },
  },
  history: {},
  additional_history: {},
  physical_exam: defaultPhysicalExam,
};
