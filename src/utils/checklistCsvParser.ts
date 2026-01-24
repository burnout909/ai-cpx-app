/**
 * CSV/TSV → EvidenceChecklist JSON 변환 유틸리티
 * 쉼표(,) 또는 탭(\t) 구분자 자동 감지
 */

export interface EvidenceChecklistItem {
  id: string;
  title: string;
  criteria: string;
  example?: string;
  DDx?: string;
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
 * 구분자 자동 감지 (탭 vs 쉼표)
 * 헤더 라인에서 탭이 있고 필수 헤더가 탭으로 구분되면 탭, 아니면 쉼표
 */
function detectDelimiter(headerLine: string): string {
  // 탭으로 분리해서 필수 헤더가 있는지 확인
  const tabSplit = headerLine.split("\t").map((h) => h.toLowerCase().trim());
  const hasTabHeaders =
    tabSplit.includes("section") &&
    tabSplit.includes("title") &&
    tabSplit.includes("criteria");

  if (hasTabHeaders) {
    return "\t";
  }

  // 쉼표로 분리해서 확인
  const commaSplit = parseDelimitedLine(headerLine, ",").map((h) => h.toLowerCase().trim());
  const hasCommaHeaders =
    commaSplit.includes("section") &&
    commaSplit.includes("title") &&
    commaSplit.includes("criteria");

  if (hasCommaHeaders) {
    return ",";
  }

  // 기본값: 탭이 더 많으면 탭, 아니면 쉼표
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;

  return tabCount >= commaCount ? "\t" : ",";
}

/**
 * 구분자로 라인을 파싱 (쌍따옴표 내 구분자 처리)
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i++;
      } else if (char === '"') {
        // 따옴표 종료
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // 따옴표 시작
        inQuotes = true;
      } else if (
        (delimiter === "\t" && char === "\t") ||
        (delimiter === "," && char === ",")
      ) {
        // 구분자 발견
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
 * 멀티라인 필드 처리를 위해 전체 텍스트를 레코드 단위로 분리
 */
function splitIntoRecords(text: string, delimiter: string): string[] {
  const records: string[] = [];
  let currentRecord = "";
  let inQuotes = false;

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!currentRecord && !line.trim()) {
      continue; // 빈 줄 건너뛰기
    }

    if (currentRecord) {
      currentRecord += "\n" + line;
    } else {
      currentRecord = line;
    }

    // 현재 레코드에서 따옴표 상태 확인
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      }
    }

    // 따옴표가 닫혔으면 레코드 완료
    if (!inQuotes) {
      if (currentRecord.trim()) {
        records.push(currentRecord);
      }
      currentRecord = "";
    }
  }

  // 마지막 레코드 처리
  if (currentRecord.trim()) {
    records.push(currentRecord);
  }

  return records;
}

/**
 * CSV/TSV 텍스트를 파싱하여 행 배열로 변환
 */
function parseCsvText(csvText: string): { rows: CsvRow[]; delimiter: string } {
  // BOM 제거
  const cleanText = csvText.replace(/^\uFEFF/, "");

  // 첫 줄(헤더) 추출
  const firstLineEnd = cleanText.indexOf("\n");
  const headerLine = firstLineEnd > 0 ? cleanText.substring(0, firstLineEnd).replace(/\r$/, "") : cleanText;

  // 구분자 감지
  const delimiter = detectDelimiter(headerLine);

  // 레코드 단위로 분리 (멀티라인 필드 처리)
  const records = splitIntoRecords(cleanText, delimiter);

  if (records.length < 2) {
    return { rows: [], delimiter };
  }

  // 헤더 파싱
  const headers = parseDelimitedLine(records[0], delimiter).map((h) => h.toLowerCase().trim());

  const sectionIdx = headers.indexOf("section");
  const titleIdx = headers.indexOf("title");
  const criteriaIdx = headers.indexOf("criteria");
  const exampleIdx = headers.indexOf("example");
  const ddxIdx = headers.indexOf("ddx");

  if (sectionIdx === -1 || titleIdx === -1 || criteriaIdx === -1) {
    return { rows: [], delimiter };
  }

  // 데이터 행 파싱
  const rows: CsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const cols = parseDelimitedLine(records[i], delimiter);
    if (cols.length === 0) continue;

    // 빈 행 건너뛰기
    const section = (cols[sectionIdx] || "").trim().toLowerCase();
    if (!section) continue;

    rows.push({
      section,
      title: (cols[titleIdx] || "").trim(),
      criteria: (cols[criteriaIdx] || "").trim(),
      example: exampleIdx !== -1 ? (cols[exampleIdx] || "").trim() : undefined,
      DDx: ddxIdx !== -1 ? (cols[ddxIdx] || "").trim() : undefined,
    });
  }

  return { rows, delimiter };
}

/**
 * CSV/TSV 텍스트를 ChecklistJson으로 변환
 */
export function parseChecklistCsv(csvText: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { rows, delimiter } = parseCsvText(csvText);

  if (rows.length === 0) {
    return {
      success: false,
      errors: [
        "CSV/TSV 파싱 실패: 유효한 데이터가 없거나 필수 헤더(section, title, criteria)가 없습니다.",
      ],
      warnings: [],
    };
  }

  // 감지된 구분자 정보
  const delimiterName = delimiter === "\t" ? "탭(TSV)" : "쉼표(CSV)";
  warnings.push(`구분자 감지: ${delimiterName} 형식으로 파싱됨`);

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
      example: row.example || undefined,
      DDx: row.DDx || undefined,
    })),
    PhysicalexamEvidenceChecklist: grouped.physicalexam.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.physicalexam}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
      example: row.example || undefined,
      DDx: row.DDx || undefined,
    })),
    EducationEvidenceChecklist: grouped.education.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.education}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
      example: row.example || undefined,
      DDx: row.DDx || undefined,
    })),
    PpiEvidenceChecklist: grouped.ppi.map((row, i) => ({
      id: `${SECTION_PREFIX_MAP.ppi}-${String(i + 1).padStart(2, "0")}`,
      title: row.title,
      criteria: row.criteria,
      example: row.example || undefined,
      DDx: row.DDx || undefined,
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
