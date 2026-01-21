import { z } from "zod";
import { VirtualPatient } from "@/types/dashboard";

const vitalsSchema = z.object({
  bp: z.string(),
  hr: z.number(),
  rr: z.number(),
  bt: z.number(),
});

export const virtualPatientOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  solution: z.string().optional(),
  type: z.string(),
  required: z.array(z.string()),
  properties: z
    .object({
      meta: z
        .object({
          chief_complaint: z.string(),
          diagnosis: z.string().optional(),
          name: z.string(),
          mrn: z.number(),
          age: z.number(),
          sex: z.string(),
          vitals: vitalsSchema,
          attitude: z.string(),
          hybrid_skill: z.string(),
        })
        .passthrough(),
    })
    .passthrough(),
  history: z.record(z.any()),
  additional_history: z.record(z.any()),
  physical_exam: z.union([z.string(), z.record(z.any())]),
  final_question: z.string().optional(),
});

export type VirtualPatientParsed = z.infer<typeof virtualPatientOutputSchema>;

export const virtualPatientTemplate: VirtualPatient = {
  id: "template_id",
  title: "",
  description: "",
  solution: "",
  type: "object",
  required: ["meta", "history", "additional_history", "physical_exam", "questions"],
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
  physical_exam: {
    general: [],
    heent: [],
    neck: [],
    chest: [],
    cardiac: [],
    abdomen: [],
    extremities: [],
    neurologic_exam: [],
    skin: [],
    miscellaneous: [],
  },
  final_question: "",
};
