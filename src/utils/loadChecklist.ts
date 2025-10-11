// src/types/checklist.ts
export interface EvidenceChecklist {
    id: string;
    title: string;
    criteria: string;
}

export interface ScoreChecklist {
    id: string;
    max_evidence_count: number;
}
type LoadResult = { evidence: EvidenceModule; score: ScoreModule };
export type EvidenceModule = {
    HistoryEvidenceChecklist: EvidenceChecklist[];
    PhysicalexamEvidenceChecklist: EvidenceChecklist[];
    EducationEvidenceChecklist: EvidenceChecklist[];
    PpiEvidenceChecklist?: EvidenceChecklist[];
};

// score 파일이 내보내는 named exports 묶음 타입
export type ScoreModule = {
    HistoryScoreChecklist: ScoreChecklist[];
    PhysicalExamScoreChecklist: ScoreChecklist[];
    EducationScoreChecklist: ScoreChecklist[];
    PpiScoreChecklist?: ScoreChecklist[];
};

export async function loadChecklistByCase(caseName: string): Promise<LoadResult> {
    switch (caseName) {
        // 🔹 소화기
        case "급성복통":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_01_acuteAbdominalPain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_01_acuteAbdominalPain")) as ScoreModule,
            };
        case "소화불량":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_02_chronicAbdominalPain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_02_chronicAbdominalPain")) as ScoreModule,
            };
        case "토혈":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_03_hematemesis")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_03_hematemesis")) as ScoreModule,
            };
        case "혈변":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_04_hematochezia")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_04_hematochezia")) as ScoreModule,
            };
        case "구토":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_05_vomiting")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_05_vomiting")) as ScoreModule,
            };
        case "변비":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_06_constipation")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_06_constipation")) as ScoreModule,
            };
        case "설사":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_07_diarrhea")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_07_diarrhea")) as ScoreModule,
            };
        case "황달":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_08_jaundice")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_08_jaundice")) as ScoreModule,
            };

        // 🔹 순환기
        case "가슴통증":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_09_chestPain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_09_chestPain")) as ScoreModule,
            };
        case "실신":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_10_syncope")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_10_syncope")) as ScoreModule,
            };
        case "두근거림":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_11_palpitation")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_11_palpitation")) as ScoreModule,
            };
        case "고혈압":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_12_hypertension")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_12_hypertension")) as ScoreModule,
            };
        case "이상지질혈증":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_13_dyslipidemia")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_13_dyslipidemia")) as ScoreModule,
            };

        // 🔹 호흡기
        case "기침":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_14_cough")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_14_cough")) as ScoreModule,
            };
        case "콧물":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_15_rhinorhea")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_15_rhinorhea")) as ScoreModule,
            };
        case "객혈":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_16_hemoptysis")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_16_hemoptysis")) as ScoreModule,
            };
        case "호흡곤란":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_17_dyspnea")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_17_dyspnea")) as ScoreModule,
            };

        // 🔹 비뇨기
        case "다뇨":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_18_polyuria")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_18_polyuria")) as ScoreModule,
            };
        case "핍뇨":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_19_oliguria")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_19_oliguria")) as ScoreModule,
            };
        case "붉은색소변":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_20_hematuria")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_20_hematuria")) as ScoreModule,
            };
        case "배뇨이상":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_21_voidingDisturbance")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_21_voidingDisturbance")) as ScoreModule,
            };
        case "요실금":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_22_incontinence")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_22_incontinence")) as ScoreModule,
            };

        // 🔹 전신계통
        case "발열":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_23_fever")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_23_fever")) as ScoreModule,
            };
        case "쉽게 멍이듦":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_24_bruisingEasily")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_24_bruisingEasily")) as ScoreModule,
            };
        case "피로":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_25_fatigue")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_25_fatigue")) as ScoreModule,
            };
        case "체중감소":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_26_weightLoss")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_26_weightLoss")) as ScoreModule,
            };
        case "체중증가":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_27_weightGain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_27_weightGain")) as ScoreModule,
            };

        // 🔹 피부관절
        case "관절통증":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_28_jointPain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_28_jointPain")) as ScoreModule,
            };
        case "허리통증":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_29_backPain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_29_backPain")) as ScoreModule,
            };
        case "목통증":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_30_neckPain")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_30_neckPain")) as ScoreModule,
            };
        case "피부발진":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_31_skinRash")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_31_skinRash")) as ScoreModule,
            };

        // 🔹 정신/신경
        case "기분장애":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_32_moodDisorder")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_32_moodDisorder")) as ScoreModule,
            };
        case "불안":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_33_anxiety")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_33_anxiety")) as ScoreModule,
            };
        case "수면장애":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_34_sleepDisturbance")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_34_sleepDisturbance")) as ScoreModule,
            };
        case "기억력저하":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_35_memoryLoss")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_35_memoryLoss")) as ScoreModule,
            };
        case "어지럼":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_36_dizziness")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_36_dizziness")) as ScoreModule,
            };
        case "두통":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_37_headache")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_37_headache")) as ScoreModule,
            };
        case "경련":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_38_seizure")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_38_seizure")) as ScoreModule,
            };
        case "근력/감각이상":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_39_limbWeaknessAndParesthesia")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_39_limbWeaknessAndParesthesia")) as ScoreModule,
            };
        case "의식장애":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_40_impairedConsciousness")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_40_impairedConsciousness")) as ScoreModule,
            };
        case "떨림":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_41_tremor")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_41_tremor")) as ScoreModule,
            };

        // 🔹 여성/소아
        case "유방덩이/통증":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_42_matalgiaAndBreastLump")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_42_matalgiaAndBreastLump")) as ScoreModule,
            };
        case "질분비물":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_43-1_vaginalDischarge")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_43-1_vaginalDischarge")) as ScoreModule,
            };
        case "질출혈":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_43-2_vaginalBleeding")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_43-2_vaginalBleeding")) as ScoreModule,
            };
        case "월경이상":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_44-1_amenorrhea")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_44-1_amenorrhea")) as ScoreModule,
            };
        case "월경통":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_44-2_dysmenorrhea")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_44-2_dysmenorrhea")) as ScoreModule,
            };
        case "산전진찰":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_45_prenatalCare")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_45_prenatalCare")) as ScoreModule,
            };
        case "성장/발달지연":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_46_growthDelayOrDevelopmentalDelay")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_46_growthDelayOrDevelopmentalDelay")) as ScoreModule,
            };
        case "예방접종":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_47_vaccination")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_47_vaccination")) as ScoreModule,
            };

        // 🔹 상담
        case "음주상담":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_48_alcoholCounseling")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_48_alcoholCounseling")) as ScoreModule,
            };
        case "금연상담":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_49_smokingCessationCounseling")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_49_smokingCessationCounseling")) as ScoreModule,
            };
        case "물질오남용":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_50_substanceAbuse")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_50_substanceAbuse")) as ScoreModule,
            };
        case "나쁜소식전하기":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_51_breakingBadNews")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_51_breakingBadNews")) as ScoreModule,
            };
        case "가정폭력":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_52_domesticViolence")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_52_domesticViolence")) as ScoreModule,
            };
        case "자살":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_53_suicide")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_53_suicide")) as ScoreModule,
            };
        case "성폭력":
            return {
                evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_54_sexualViolence")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/scoreChecklist_54_sexualViolence")) as ScoreModule,
            };
        // 🔁 기본 fallback (준비 안 된 케이스)
        default:
            return {
                evidence: (await import("@/assets/evidenceChecklist/baseEvidenceChecklist")) as EvidenceModule,
                score: (await import("@/assets/scoreChecklist/baseScoreChecklist")) as ScoreModule,
            };
    }
}

