# /add-case — 새 의학 케이스 체크리스트 추가

## Metadata
- disable-model-invocation: true
- user-invocable: true

## Description
새로운 의학 케이스의 evidence checklist와 score checklist 파일을 생성하고, `loadChecklist.ts`에 등록합니다.

## Usage
```
/add-case <번호> <영문이름> <한국어케이스명> [카테고리]
```
예시: `/add-case 55 insomnia 불면증 정신/신경`

## Steps

### 1. Evidence Checklist 생성
- **파일**: `src/assets/evidenceChecklist/evidenceChecklist_<번호>_<영문이름>.ts`
- **참조 패턴**: `src/assets/evidenceChecklist/evidenceChecklist_01_acuteAbdominalPain.ts`
- **필수 exports**:
  - `HistoryEvidenceChecklist: EvidenceChecklist[]`
  - `PhysicalexamEvidenceChecklist: EvidenceChecklist[]`
  - `EducationEvidenceChecklist: EvidenceChecklist[]`
  - `PpiEvidenceChecklist: EvidenceChecklist[]`
- **인터페이스**:
  ```typescript
  export interface EvidenceChecklist {
    id: string;      // "HX-01", "PE-01", "ED-01", "PPI-01" 등
    title: string;   // 항목 제목 (한국어)
    criteria: string; // 평가 기준 (한국어, "~하였는가?" 형태)
    example?: string[]; // 예시 발화 (선택사항)
  }
  ```
- **ID 규칙**: HX-01~HX-XX (병력), PE-01~PE-XX (신체진찰), ED-01~ED-XX (환자교육), PPI-01~PPI-XX (의사-환자 상호작용)

### 2. Score Checklist 생성
- **파일**: `src/assets/scoreChecklist/scoreChecklist_<번호>_<영문이름>.ts`
- **참조 패턴**: `src/assets/scoreChecklist/scoreChecklist_01_acuteAbdominalPain.ts`
- **필수 exports**:
  - `HistoryScoreChecklist: ScoreChecklist[]`
  - `PhysicalExamScoreChecklist: ScoreChecklist[]` (주의: PhysicalExam, not Physicalexam)
  - `EducationScoreChecklist: ScoreChecklist[]`
  - `PpiScoreChecklist: ScoreChecklist[]`
- **인터페이스**:
  ```typescript
  export interface ScoreChecklist {
    id: string;             // evidence checklist의 id와 1:1 매칭
    max_evidence_count: number; // 현재 대부분 1로 설정
  }
  ```

### 3. loadChecklist.ts에 switch case 추가
- **파일**: `src/utils/loadChecklist.ts`
- **위치**: 해당 카테고리 주석 아래에 추가
- **패턴**:
  ```typescript
  case "한국어케이스명":
      return {
          evidence: (await import("@/assets/evidenceChecklist/evidenceChecklist_<번호>_<영문이름>")) as EvidenceModule,
          score: (await import("@/assets/scoreChecklist/scoreChecklist_<번호>_<영문이름>")) as ScoreModule,
      };
  ```

### 4. 검증
- Evidence checklist의 모든 ID가 score checklist에 존재하는지 확인
- `npm run build`로 타입 오류 없는지 확인

## 카테고리 목록
- 🔹 소화기 (01-08)
- 🔹 순환기 (09-13)
- 🔹 호흡기 (14-17)
- 🔹 비뇨기 (18-22)
- 🔹 전신계통 (23-27)
- 🔹 피부관절 (28-31)
- 🔹 정신/신경 (32-41)
- 🔹 여성/소아 (42-47)
- 🔹 상담 (48-54)
