export interface EvidenceListItem {
    id: string;
    evidence: string[];
}

export interface SectionResult {
    sectionId: string;
    evidenceList: EvidenceListItem[];
}

export interface GradeItem {
    id: string;
    title: string;
    criteria: string;
    evidence: string[];
    point: number;
    max_evidence_count: number;
}
