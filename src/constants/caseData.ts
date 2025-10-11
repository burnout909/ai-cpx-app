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
export const UPLOAD_RECORD_CASE_CATEGORIES: CaseCategory[] = [
    {
        id: 1,
        name: "소화기",
        count: 8,
        details: [
            { id: 1, name: "급성복통" },
            { id: 2, name: "소화불량" },
            { id: 3, name: "토혈" },
            { id: 4, name: "혈변" },
            { id: 5, name: "구토" },
            { id: 6, name: "변비" },
            { id: 7, name: "설사" },
            { id: 8, name: "황달" }
        ],
    },
    {
        id: 2,
        name: "순환기",
        count: 5,
        details: [
            { id: 1, name: "가슴통증" },
            { id: 2, name: "실신" },
            { id: 3, name: "두근거림" },
            { id: 4, name: "고혈압" },
            { id: 5, name: "이상지질혈증" },
        ],
    },
    {
        id: 3,
        name: "호흡기",
        count: 4,
        details: [
            { id: 1, name: "기침" },
            { id: 2, name: "콧물" },
            { id: 3, name: "객혈" },
            { id: 4, name: "호흡곤란" },
        ],
    },
    {
        id: 4,
        name: "비뇨기",
        count: 5,
        details: [
            { id: 1, name: "다뇨" },
            { id: 2, name: "핍뇨" },
            { id: 3, name: "붉은색소변" },
            { id: 4, name: "배뇨이상" },
            { id: 5, name: "요실금" },
        ],
    },
    {
        id: 5,
        name: "전신계통",
        count: 5,
        details: [
            { id: 1, name: "발열" },
            { id: 2, name: "쉽게 멍이듦" },
            { id: 3, name: "피로" },
            { id: 4, name: "체중감소" },
            { id: 5, name: "체중증가" },
        ],
    },
    {
        id: 6,
        name: "피부관절",
        count: 4,
        details: [
            { id: 1, name: "관절통증" },
            { id: 2, name: "목통증" },
            { id: 3, name: "허리통증" },
            { id: 4, name: "피부발진" },
        ],
    },
    {
        id: 7,
        name: "정신/신경",
        count: 6,
        details: [
            { id: 1, name: "기분장애" },
            { id: 2, name: "불안" },
            { id: 3, name: "수면장애" },
            { id: 4, name: "기억력저하" },
            { id: 5, name: "어지럼" },
            { id: 6, name: "두통" },
            { id: 7, name: "경련" },
            { id: 8, name: "근력/감각이상" },
            { id: 9, name: "의식장애" },
            { id: 10, name: "떨림" },
        ],
    },
    {
        id: 8,
        name: "여성/소아",
        count: 6,
        details: [
            { id: 1, name: "유방덩이/통증" },
            { id: 2, name: "질분비물" },
            { id: 3, name: "질출혈" },
            { id: 4, name: "월경이상" },
            { id: 5, name: "월경통" },
            { id: 6, name: "산전진찰" },
            { id: 7, name: "성장/발달지연" },
            { id: 8, name: "예방접종" },
        ],
    },
    {
        id: 9,
        name: "상담",
        count: 7,
        details: [
            { id: 1, name: "음주상담" },
            { id: 2, name: "금연상담" },
            { id: 3, name: "물질오남용" },
            { id: 4, name: "나쁜소식전하기" },
            { id: 5, name: "가정폭력" },
            { id: 6, name: "성폭력" },
            { id: 7, name: "자살" },
        ],
    },
];


// 3️전체 카테고리 배열
export const LIVE_CASE_CATEGORIES: CaseCategory[] = [
    {
        id: 1,
        name: "소화기",
        count: 1,
        details: [
            { id: 1, name: "급성복통" },
            // { id: 2, name: "소화불량" },
            // { id: 3, name: "토혈" },
            // { id: 4, name: "혈변" },
            // { id: 5, name: "구토" },
            // { id: 6, name: "변비" },
            // { id: 7, name: "설사" },
            // { id: 8, name: "황달" }
        ],
    },
    {
        id: 2,
        name: "순환기",
        count: 1,
        details: [
            { id: 1, name: "가슴통증" },
            // { id: 2, name: "실신" },
            // { id: 3, name: "두근거림" },
            // { id: 4, name: "고혈압" },
            // { id: 5, name: "이상지질혈증" },
        ],
    },
    {
        id: 3,
        name: "호흡기",
        count: 1,
        details: [
            // { id: 1, name: "기침" },
            // { id: 2, name: "콧물" },
            // { id: 3, name: "객혈" },
            { id: 4, name: "호흡곤란" },
        ],
    },
    // {
    //     id: 4,
    //     name: "비뇨기",
    //     count: 5,
    //     details: [
    //         { id: 1, name: "다뇨" },
    //         { id: 2, name: "핍뇨" },
    //         { id: 3, name: "붉은색소변" },
    //         { id: 4, name: "배뇨이상" },
    //         { id: 5, name: "요실금" },
    //     ],
    // },
    // {
    //     id: 5,
    //     name: "전신계통",
    //     count: 5,
    //     details: [
    //         { id: 1, name: "발열" },
    //         { id: 2, name: "쉽게 멍이듦" },
    //         { id: 3, name: "피로" },
    //         { id: 4, name: "체중감소" },
    //         { id: 5, name: "체중증가" },
    //     ],
    // },
    // {
    //     id: 6,
    //     name: "피부관절",
    //     count: 4,
    //     details: [
    //         { id: 1, name: "관절통증" },
    //         { id: 2, name: "목통증" },
    //         { id: 3, name: "허리통증" },
    //         { id: 4, name: "피부발진" },
    //     ],
    // },
    // {
    //     id: 7,
    //     name: "정신/신경",
    //     count: 10,
    //     details: [
    //         { id: 1, name: "기분장애" },
    //         { id: 2, name: "불안" },
    //         { id: 3, name: "수면장애" },
    //         { id: 4, name: "기억력저하" },
    //         { id: 5, name: "어지럼" },
    //         { id: 6, name: "두통" },
    // { id: 7, name: "경련" },
    // { id: 8, name: "근력/감각이상" },
    // { id: 9, name: "의식장애" },
    // { id: 10, name: "떨림" },
    //     ],
    // },
    // {
    //     id: 8,
    //     name: "여성/소아",
    //     count: 6,
    //     details: [
    //         { id: 1, name: "유방덩이/통증" },
    //         { id: 2, name: "질분비물/질출혈" },
    //         { id: 3, name: "월경이상/월경통" },
    //         { id: 4, name: "산전진찰" },
    //         { id: 5, name: "성장/발달지연" },
    //         { id: 6, name: "예방접종" },
    //     ],
    // },
    // {
    //     id: 9,
    //     name: "상담",
    //     count: 7,
    //     details: [
    //         { id: 1, name: "음주상담" },
    //         { id: 2, name: "금연상담" },
    //         { id: 3, name: "물질오남용" },
    //         { id: 4, name: "나쁜소식전하기" },
    //         { id: 5, name: "가정폭력" },
    //         { id: 6, name: "성폭력" },
    //         { id: 7, name: "자살" },
    //     ],
    // },
];
