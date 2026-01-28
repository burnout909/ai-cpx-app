// utils/loadVPProfile.ts
import type { StaticImageData } from "next/image";

// Meta 정보 인터페이스
interface VirtualPatientMeta {
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
  [key: string]: unknown;
}

export interface VirtualPatient {
  id: string;
  title: string;
  description: string;
  type: string;
  required: string[];

  // 새 스키마: meta가 루트 레벨에 위치
  meta?: VirtualPatientMeta;

  // 구 스키마: properties.meta 구조 (하위 호환성)
  properties?: {
    meta: VirtualPatientMeta;
    [key: string]: unknown;
  };

  // history는 string 또는 object 형태 모두 가능
  history: Record<string, unknown>;

  // additional_history도 동일하게
  additional_history: Record<string, unknown>;

  // physical_exam은 string 또는 object 모두 가능
  physical_exam: string | Record<string, unknown>;

  // questions는 string으로 통일
  questions?: string | string[];
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

type VPSolutionModule = { default: string };

// 케이스 이름 → solution 로더 매핑
const CASE_TO_SOLUTION: Record<string, () => Promise<VPSolutionModule>> = {
  "급성복통": () => import("@/assets/virtualPatient/acute_abdominal_pain_001_solution"),
  "호흡곤란": () => import("@/assets/virtualPatient/dyspnea_001_solution"),
  "가슴통증": () => import("@/assets/virtualPatient/chest_pain_001_solution"),
  "어지럼": () => import("@/assets/virtualPatient/dizziness_001_solution"),
};



export async function loadVPSolution(caseName: string): Promise<string> {
  const loader = CASE_TO_SOLUTION[caseName];
  if(!loader) {
    throw new Error(`해당 케이스(${caseName})에 대한 프로필 이미지가 없습니다.`);
  }
  const mod = await loader();
  return mod.default; // StaticImageData
}