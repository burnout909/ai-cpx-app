import { CHIEF_COMPLAINTS_BY_CATEGORY, ChiefComplaintCategory } from "./chiefComplaints";

// 1️세부 카테고리 타입
export type CaseDetail = {
    id: number;
    name: string;
};

// 2️대분류 카테고리 타입
export type CaseCategory = {
    id: number;
    name: string;
    count: number;
    details: CaseDetail[];
};

// 카테고리 순서 정의
const CATEGORY_ORDER: ChiefComplaintCategory[] = [
    "소화기",
    "순환기",
    "호흡기",
    "비뇨기",
    "전신계통",
    "피부관절",
    "정신신경",
    "여성소아",
    "상담",
];

// chiefComplaints.ts에서 CaseCategory 배열 생성
function buildCaseCategories(): CaseCategory[] {
    return CATEGORY_ORDER.map((category, index) => {
        const complaints = CHIEF_COMPLAINTS_BY_CATEGORY[category];
        return {
            id: index + 1,
            name: category,
            count: complaints.length,
            details: complaints.map((name, detailIndex) => ({
                id: detailIndex + 1,
                name,
            })),
        };
    });
}

// 3️전체 카테고리 배열
export const UPLOAD_RECORD_CASE_CATEGORIES: CaseCategory[] = buildCaseCategories();
export const LIVE_CASE_CATEGORIES: CaseCategory[] = buildCaseCategories();
