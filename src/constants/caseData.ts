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

// 3️전체 카테고리 배열
export const CASE_CATEGORIES: CaseCategory[] = [
    {
        id: 1,
        name: "소화기",
        count: 8,
        details: [
            { id: 1, name: "소화불량" },
            { id: 2, name: "토혈" },
            { id: 3, name: "혈변" },
            { id: 4, name: "구토" },
            { id: 5, name: "변비" },
            { id: 6, name: "설사" },
            { id: 7, name: "황달" },
            { id: 8, name: "복통" },
        ],
    },
    {
        id: 2,
        name: "순환기",
        count: 5,
        details: [
            { id: 1, name: "흉통" },
            { id: 2, name: "호흡곤란" },
            { id: 3, name: "실신" },
            { id: 4, name: "부종" },
            { id: 5, name: "심계항진" },
        ],
    },
    {
        id: 3,
        name: "호흡기",
        count: 4,
        details: [
            { id: 1, name: "기침" },
            { id: 2, name: "가래" },
            { id: 3, name: "객혈" },
            { id: 4, name: "호흡곤란" },
        ],
    },
    {
        id: 4,
        name: "비뇨기",
        count: 5,
        details: [
            { id: 1, name: "혈뇨" },
            { id: 2, name: "배뇨통" },
            { id: 3, name: "빈뇨" },
            { id: 4, name: "요정체" },
            { id: 5, name: "요실금" },
        ],
    },
    {
        id: 5,
        name: "전신",
        count: 5,
        details: [
            { id: 1, name: "발열" },
            { id: 2, name: "체중감소" },
            { id: 3, name: "피로" },
            { id: 4, name: "야간발한" },
            { id: 5, name: "식욕감퇴" },
        ],
    },
    {
        id: 6,
        name: "피부/관절",
        count: 5,
        details: [
            { id: 1, name: "관절통" },
            { id: 2, name: "피부발진" },
            { id: 3, name: "근육통" },
            { id: 4, name: "부종" },
            { id: 5, name: "창상/상처" },
        ],
    },
    {
        id: 7,
        name: "정신/신경",
        count: 10,
        details: [
            { id: 1, name: "두통" },
            { id: 2, name: "어지럼증" },
            { id: 3, name: "경련" },
            { id: 4, name: "의식저하" },
            { id: 5, name: "기억력저하" },
            { id: 6, name: "불안" },
            { id: 7, name: "우울" },
            { id: 8, name: "불면" },
            { id: 9, name: "피로감" },
            { id: 10, name: "집중력저하" },
        ],
    },
    {
        id: 8,
        name: "여성/소아",
        count: 6,
        details: [
            { id: 1, name: "월경이상" },
            { id: 2, name: "질출혈" },
            { id: 3, name: "복통(여성)" },
            { id: 4, name: "소아발열" },
            { id: 5, name: "소아기침" },
            { id: 6, name: "소아구토" },
        ],
    },
    {
        id: 9,
        name: "상담",
        count: 7,
        details: [
            { id: 1, name: "금연상담" },
            { id: 2, name: "음주상담" },
            { id: 3, name: "비만상담" },
            { id: 4, name: "영양상담" },
            { id: 5, name: "운동상담" },
            { id: 6, name: "약물상담" },
            { id: 7, name: "스트레스관리" },
        ],
    },
];
