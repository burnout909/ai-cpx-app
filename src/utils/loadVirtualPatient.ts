// utils/loadVPProfile.ts
import type { StaticImageData } from "next/image";

export interface VirtualPatient {
  id: string;
  title: string;
  description: string;
  type: string;
  required: string[];

  // properties 내부 구조는 공통적으로 meta가 존재하지만,
  // 그 외는 케이스마다 달라질 수 있으므로 any로 유연하게 둔다.
  properties: {
    meta: {
      chief_complaint: string;
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
    [key: string]: any; // 다른 필드 허용
  };

  // history는 string 또는 object 형태 모두 가능
  history: Record<string, any>;

  // additional_history도 동일하게
  additional_history: Record<string, any>;

  // physical_exam은 string 또는 object 모두 가능
  physical_exam: string | Record<string, any>;

  // questions는 string으로 통일
  questions: string | string[];
}


export async function loadVirtualPatient(caseName: string): Promise<VirtualPatient> {
  switch (caseName) {
    case "급성복통":
      return (await import("@/assets/virtualPatient/acute_abdominal_pain_001.json")).default as VirtualPatient;

    case "호흡곤란":
      return (await import("@/assets/virtualPatient/dyspnea_001.json")).default as VirtualPatient;

    case "가슴통증":
      return (await import("@/assets/virtualPatient/chest_pain_001.json")).default as VirtualPatient;

    case "어지럼":
      return (await import("@/assets/virtualPatient/dizziness_001.json")).default as VirtualPatient;

    default:
      throw new Error(`해당 케이스(${caseName})에 대한 가상환자 데이터가 없습니다.`);
  }
}

export type VPProfile = StaticImageData;

type ImageModule = { default: StaticImageData };

// 케이스 이름 → 이미지 모듈 로더 매핑
const CASE_TO_IMAGE: Record<string, () => Promise<ImageModule>> = {
  "급성복통": () => import("@/assets/virtualPatient/acute_abdominal_pain_001.png"),
  "호흡곤란": () => import("@/assets/virtualPatient/dyspnea_001.png"),
  "가슴통증": () => import("@/assets/virtualPatient/chest_pain_001.png"),
  "어지럼": () => import("@/assets/virtualPatient/dizziness_001.png"),
};

export async function loadVPProfile(caseName: string): Promise<VPProfile> {
  const loader = CASE_TO_IMAGE[caseName];
  if (!loader) {
    throw new Error(`해당 케이스(${caseName})에 대한 프로필 이미지가 없습니다.`);
  }
  const mod = await loader();
  return mod.default; // StaticImageData
}