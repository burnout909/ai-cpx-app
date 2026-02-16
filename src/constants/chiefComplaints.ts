/**
 * 54개 주호소 상수 정의
 * loadChecklist.ts의 switch case에서 추출
 */

export const CHIEF_COMPLAINTS_BY_CATEGORY = {
  소화기: [
    "급성복통",
    "소화불량",
    "토혈",
    "혈변",
    "구토",
    "변비",
    "설사",
    "황달",
  ],
  순환기: [
    "가슴통증",
    "실신",
    "두근거림",
    "고혈압",
    "이상지질혈증",
  ],
  호흡기: [
    "기침",
    "콧물",
    "객혈",
    "호흡곤란",
  ],
  비뇨기: [
    "다뇨",
    "핍뇨",
    "붉은색소변",
    "배뇨이상/요실금",
  ],
  전신계통: [
    "발열",
    "쉽게 멍이듦",
    "피로",
    "체중감소",
    "체중증가",
  ],
  피부관절: [
    "관절통증",
    "허리통증",
    "목통증",
    "피부발진",
  ],
  정신신경: [
    "기분장애",
    "불안",
    "수면장애",
    "기억력저하",
    "어지럼",
    "두통",
    "경련",
    "근력/감각이상",
    "의식장애",
    "떨림",
  ],
  여성소아: [
    "유방덩이/통증",
    "질분비물",
    "질출혈",
    "월경이상",
    "월경통",
    "산전진찰",
    "성장/발달지연",
    "예방접종",
  ],
  상담: [
    "음주상담",
    "금연상담",
    "물질오남용",
    "나쁜소식전하기",
    "가정폭력",
    "자살",
    "성폭력",
  ],
} as const;

export type ChiefComplaintCategory = keyof typeof CHIEF_COMPLAINTS_BY_CATEGORY;

// 전체 주호소 목록 (flat array)
export const CHIEF_COMPLAINTS = Object.values(CHIEF_COMPLAINTS_BY_CATEGORY).flat();

export type ChiefComplaint = (typeof CHIEF_COMPLAINTS)[number];

// 카테고리와 함께 주호소 목록 반환 (UI용)
export interface ChiefComplaintWithCategory {
  name: ChiefComplaint;
  category: ChiefComplaintCategory;
}

export function getChiefComplaintsWithCategory(): ChiefComplaintWithCategory[] {
  const result: ChiefComplaintWithCategory[] = [];

  for (const [category, complaints] of Object.entries(CHIEF_COMPLAINTS_BY_CATEGORY)) {
    for (const name of complaints) {
      result.push({
        name: name as ChiefComplaint,
        category: category as ChiefComplaintCategory,
      });
    }
  }

  return result;
}
