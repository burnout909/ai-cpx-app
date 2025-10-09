export interface VirtualPatient {
    id: string;
    title: string;
    description: string;
    type: string;
    required: string[];
    properties: any;
    history: Record<string, string>;
    additional_history: Record<string, string>;
    physical_exam: string;
    questions: string;
}

export async function loadVirtualPatient(caseName: string): Promise<VirtualPatient> {
    switch (caseName) {
        case "급성복통":
            return (await import("@/assets/virtualPatient/acute_abdominal_pain_001.json")).default as VirtualPatient;

        case "호흡곤란":
            return (await import("@/assets/virtualPatient/dyspnea_001.json")).default as VirtualPatient;

        case "가슴통증":
            return (await import("@/assets/virtualPatient/chest_pain_001.json")).default as VirtualPatient;

        default:
            throw new Error(`해당 케이스(${caseName})에 대한 가상환자 데이터가 없습니다.`);
    }
}
