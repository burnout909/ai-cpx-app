# /score-debug — 스코어링 파이프라인 디버깅

## Metadata
- disable-model-invocation: true
- user-invocable: true

## Description
스코어링 파이프라인의 문제를 진단하고 디버깅하는 가이드입니다. 파이프라인의 각 단계를 분석하고 일반적인 오류 패턴과 해결법을 제시합니다.

## Pipeline Overview

### 데이터 흐름
```
Audio (S3) → Transcribe (Whisper) → Collect Evidence (GPT-5.1) → Classify Sections → Calculate Grades → Save Results (S3)
```

### 핵심 파일
- **파이프라인 오케스트레이터**:
  - `src/hooks/score/useAutoPipeline.ts` (업로드/녹화)
  - `src/hooks/score/useLiveAutoPipeline.ts` (라이브 VP)
- **API 엔드포인트**:
  - `/api/transcribe` - Whisper 전사
  - `/api/collectEvidence` - 증거 수집 (GPT-5.1 structured output, fallback: GPT-4o-mini)
  - `/api/classifySections` - 섹션 시간 분류
  - `/api/feedback` - 내러티브 피드백 생성
- **체크리스트 로더**: `src/utils/loadChecklist.ts`
- **유틸리티**: `src/utils/score.ts` (ensureOkOrThrow, readJsonOrText)

### 단계별 디버깅

#### 1단계: 체크리스트 로드
- **문제**: 케이스명 불일치 → default(base) 체크리스트 사용됨
- **확인**: `loadChecklist.ts`의 switch문에 해당 한국어 케이스명이 정확히 있는지 확인
- **DB 체크리스트**: `checklistId`가 있으면 `/api/admin/checklist`에서 로드

#### 2단계: 전사 (Transcribe)
- **API**: `/api/transcribe` → Whisper
- **입력**: `{ s3_key: string }`
- **출력**: `{ text: string, segments: ApiSegment[] }`
- **일반 오류**: S3 키 잘못됨, 오디오 파일 손상, Whisper API 한도 초과
- **멀티파트**: 여러 오디오 파일은 병렬 전사 후 텍스트 합치기, segments offset 조정

#### 3단계: 증거 수집 (Collect Evidence)
- **API**: `/api/collectEvidence` → GPT-5.1 (Structured Output), fallback GPT-4o-mini
- **입력**: `{ transcript, evidenceChecklist, sectionId }`
- **섹션별 실행**: history, physical_exam, education, ppi 4개 섹션 병렬
- **출력**: `{ evidenceList: [{ id, title, criteria, evidence: string[] }] }`
- **일반 오류**: 전사 텍스트 너무 길어 토큰 초과, structured output 파싱 실패 → fallback
- **Zod 스키마**: `EvidenceSchema` (id, title, criteria, evidence 배열)

#### 4단계: 섹션 분류 (Classify Sections)
- **API**: `/api/classifySections`
- **collectEvidence와 병렬 실행**
- **출력**: `SectionTimingMap` (각 섹션의 시작/끝 시간)
- **실패해도 채점에 영향 없음** (catch로 null 반환)

#### 5단계: 점수 계산
- Evidence checklist 항목별로 evidence 존재 여부 → point (현재 min(evidence.length, 1))
- `max_evidence_count`는 현재 미사용 (하드코딩 1)

### S3 저장 구조
- **오디오**: `SP_audio/`, `VP_audio/`
- **전사**: `SP_script/` (오디오 키에서 자동 변환)
- **피드백/점수**: metadata API를 통해 추적

### 일반적인 문제 패턴

| 증상 | 원인 | 해결 |
|------|------|------|
| 모든 항목 0점 | 전사 실패 또는 빈 텍스트 | `/api/transcribe` 응답 확인 |
| 특정 섹션만 0점 | 해당 체크리스트 비어있음 | evidence checklist 파일 확인 |
| base 체크리스트 사용됨 | caseName 불일치 | loadChecklist switch문의 한국어명 확인 |
| structured output 에러 | GPT-5.1 API 문제 | fallback(GPT-4o-mini)이 작동하는지 확인 |
| 전사 텍스트 이상 | 오디오 품질 문제 | S3에서 원본 오디오 확인 |
