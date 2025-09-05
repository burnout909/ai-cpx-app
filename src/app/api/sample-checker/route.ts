import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ----- Types -----
interface CheckerItem {
  id: string;
  label: string;
  detail?: string;
}

type MetricType = "binary" | "ternary_uap" | "likert_1to5";

interface CheckerSection {
  metric: MetricType;
  items_required: number;
  items: CheckerItem[];
}

interface CheckerSections {
  history: CheckerSection;
  physical_exam: CheckerSection;
  education: CheckerSection;
  ppi: CheckerSection;
}

interface CheckerWeights {
  history: number;
  physical_exam: number;
  education: number;
  ppi: number;
}

interface CaseMeta {
  id: string;
  chief_complaint: string;
  title: string;
  age: number;
  sex: "M" | "F";
  summary: string;
}

interface Checker {
  project: string;
  case: CaseMeta;
  weights: CheckerWeights;
  sections: CheckerSections;
}

// ----- Data -----
function sampleChecker(): Checker {
  return {
    project: "ai-cpx",
    case: {
      id: "sample-acute-abd-pain",
      chief_complaint: "급성 복통",
      title: "RUQ 통증과 발열",
      age: 32,
      sex: "F",
      summary: "우상복부 통증 + 발열",
    },
    weights: { history: 40, physical_exam: 30, education: 20, ppi: 10 },
    sections: {
      history: {
        metric: "binary",
        items_required: 10,
        items: [
          { id: "HX-01", label: "복통이 시작된 시점을 확인하였다.", detail: "발병 시각과 급성/서서히 여부" },
          { id: "HX-02", label: "복통의 위치와 이동 양상, 방사통, 빈도를 확인하였다.", detail: "위치, 이동, 방사, 빈도" },
          { id: "HX-03", label: "통증의 양상에 대해 질문하였다.", detail: "찌르는/조이는/쥐어짜는/간헐/지속" },
          { id: "HX-04", label: "복통의 강도를 확인하였다.", detail: "0~10 통증척도" },
          { id: "HX-05", label: "악화/완화 인자 확인", detail: "식사/배뇨/배변/체위" },
          { id: "HX-06", label: "소화기 증상 질문", detail: "구역/구토/설사/혈변/황달" },
          { id: "HX-07", label: "산부인과 병력 확인", detail: "월경/성관계/질출혈" },
          { id: "HX-08", label: "순환기 증상 확인", detail: "가슴통증/호흡곤란" },
          { id: "HX-09", label: "현재 복용 약/과거력/가족력 확인", detail: "약/수술·외상/과거 GI/가족력" },
          { id: "HX-10", label: "생활습관 확인", detail: "식이/음주/흡연/운동" },
        ],
      },
      physical_exam: {
        metric: "ternary_uap",
        items_required: 6,
        items: [
          { id: "PE-01", label: "활력징후 확인", detail: "BP/PR/BT/RR" },
          { id: "PE-02", label: "결막/공막 검사", detail: "눈 확인" },
          { id: "PE-03", label: "자세 세팅", detail: "반듯이+무릎 세움" },
          { id: "PE-04", label: "시-청-타-촉 순서", detail: "순서 준수" },
          { id: "PE-05", label: "반발통 확인", detail: "통증 부위 마지막 촉진" },
          { id: "PE-06", label: "CVAT 확인", detail: "늑골척추각" },
        ],
      },
      education: {
        metric: "ternary_uap",
        items_required: 8,
        items: [
          { id: "ED-01", label: "가능진단 설명" },
          { id: "ED-02", label: "검사 필요성 설명" },
          { id: "ED-03", label: "치료/경과 설명" },
          { id: "ED-04", label: "금식 안내" },
          { id: "ED-05", label: "생활지도" },
          { id: "ED-06", label: "경고증상 재내원" },
          { id: "ED-07", label: "추적 계획" },
          { id: "ED-08", label: "문진 확인질문" },
        ],
      },
      ppi: {
        metric: "likert_1to5",
        items_required: 6,
        items: [
          { id: "PPI-01", label: "개방형 질문/경청" },
          { id: "PPI-02", label: "공감/정상화" },
          { id: "PPI-03", label: "쉬운 용어 사용" },
          { id: "PPI-04", label: "중간 요약" },
          { id: "PPI-05", label: "질문 기회 제공" },
          { id: "PPI-06", label: "체계적 진행/시간배분" },
        ],
      },
    },
  };
}

// ----- Route -----
export async function GET() {
  return NextResponse.json(sampleChecker());
}
