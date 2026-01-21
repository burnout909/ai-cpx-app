/**
 * CSV → EvidenceChecklist JSON 변환 유틸리티
 */

export interface EvidenceChecklistItem {
  id: string;
  title: string;
  criteria: string;
}

export interface ChecklistJson {
  HistoryEvidenceChecklist: EvidenceChecklistItem[];
  PhysicalexamEvidenceChecklist: EvidenceChecklistItem[];
  EducationEvidenceChecklist: EvidenceChecklistItem[];
  PpiEvidenceChecklist: EvidenceChecklistItem[];
}

export interface CsvRow {
  section: string;
  title: string;
  criteria: string;
  example?: string;
  DDx?: string;
}

export interface CsvParseResult {
  success: boolean;
  data?: ChecklistJson;
  errors: string[];
  warnings: string[];
}

const VALID_SECTIONS = ["history", "physicalexam", "education", "ppi"] as const;
type ValidSection = (typeof VALID_SECTIONS)[number];

const SECTION_PREFIX_MAP: Record<ValidSection, string> = {
  history: "HX",
  physicalexam: "PE",
  education: "ED",
  ppi: "PPI",
};

/**
 * CSV 텍스트를 파싱하여 행 배열로 변환
 */
function parseCsvText(csvText: string): CsvRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  // BOM 제거
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const sectionIdx = headers.indexOf("section");
  const titleIdx = headers.indexOf("title");
  const criteriaIdx = headers.indexOf("criteria");
  const exampleIdx = headers.indexOf("example");
  const ddxIdx = headers.indexOf("ddx");

  if (sectionIdx === -1 || titleIdx === -1 || criteriaIdx === -1) {
    return [];
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0) continue;

    rows.push({
      section: (cols[sectionIdx] || "").trim().toLowerCase(),
      title: (cols[titleIdx] || "").trim(),
      criteria: (cols[criteriaIdx] || "").trim(),
      example: exampleIdx !== -1 ? (cols[exampleIdx] || "").trim() : undefined,
      DDx: ddxIdx !== -1 ? (cols[ddxIdx] || "").trim() : undefined,
    });
  }

  return rows;
}

/**
 * CSV 라인을 파싱 (쌍따옴표 내 쉼표/줄바꿈 처리)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

/**
 * CSV 텍스트를 ChecklistJson으로 변환
 */
export function parseChecklistCsv(csvText: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rows = parseCsvText(csvText);

  if (rows.length === 0) {
    return {
      success: false,
      errors: ["CSV 파싱 실패: 유효한 데이터가 없거나 필수 헤더(section, title, criteria)가 없습니다."],
      warnings: [],
    };
  }

  // 섹션별 분류
  const grouped: Record<ValidSection, CsvRow[]> = {
    history: [],
    physicalexam: [],
    education: [],
    ppi: [],
  };

  rows.forEach((row, idx) => {
    const lineNum = idx + 2; // 헤더가 1번, 데이터는 2번부터

    if (!row.section) {
      warnings.push(`${lineNum}행: section 값이 비어있습니다. 건너뜁니다.`);
      return;
    }

    if (!VALID_SECTIONS.includes(row.section as ValidSection)) {
      errors.push(
        `${lineNum}행: 유효하지 않은 section 값 "${row.section}". 허용값: ${VALID_SECTIONS.join(", ")}`
      );
      return;
    }

    if (!row.title || !row.criteria) {
      warnings.push(`${lineNum}행: title 또는 criteria가 비어있습니다.`);
    }

    grouped[row.section as ValidSection].push(row);
  });

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // JSON 변환
  const data: ChecklistJson = {
    HistoryEvidenceChecklist: grouped.history.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.history}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
    })),
    PhysicalexamEvidenceChecklist: grouped.physicalexam.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.physicalexam}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
    })),
    EducationEvidenceChecklist: grouped.education.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.education}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
    })),
    PpiEvidenceChecklist: grouped.ppi.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.ppi}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
    })),
  };

  return { success: true, data, errors: [], warnings };
}

/**
 * 두 ChecklistJson 간의 diff 계산
 */
export interface DiffItem {
  section: string;
  id: string;
  type: "added" | "removed" | "modified";
  oldValue?: EvidenceChecklistItem;
  newValue?: EvidenceChecklistItem;
}

export function computeChecklistDiff(
  oldJson: ChecklistJson | null,
  newJson: ChecklistJson
): DiffItem[] {
  const diffs: DiffItem[] = [];

  const sections: { key: keyof ChecklistJson; label: string }[] = [
    { key: "HistoryEvidenceChecklist", label: "history" },
    { key: "PhysicalexamEvidenceChecklist", label: "physicalexam" },
    { key: "EducationEvidenceChecklist", label: "education" },
    { key: "PpiEvidenceChecklist", label: "ppi" },
  ];

  for (const { key, label } of sections) {
    const oldItems = oldJson?.[key] ?? [];
    const newItems = newJson[key];

    const oldMap = new Map(oldItems.map((item) => [item.id, item]));
    const newMap = new Map(newItems.map((item) => [item.id, item]));

    // 추가된 항목
    for (const [id, item] of newMap) {
      if (!oldMap.has(id)) {
        diffs.push({ section: label, id, type: "added", newValue: item });
      }
    }

    // 삭제된 항목
    for (const [id, item] of oldMap) {
      if (!newMap.has(id)) {
        diffs.push({ section: label, id, type: "removed", oldValue: item });
      }
    }

    // 수정된 항목
    for (const [id, newItem] of newMap) {
      const oldItem = oldMap.get(id);
      if (oldItem) {
        if (oldItem.title !== newItem.title || oldItem.criteria !== newItem.criteria) {
          diffs.push({
            section: label,
            id,
            type: "modified",
            oldValue: oldItem,
            newValue: newItem,
          });
        }
      }
    }
  }

  return diffs;
}
