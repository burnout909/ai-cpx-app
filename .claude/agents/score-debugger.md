---
name: score-debugger
description: 스코어링 파이프라인의 문제를 진단하고 수정하는 에이전트입니다. 전사 → 증거수집 → 섹션분류 → 채점 각 단계별로 디버깅합니다.
model: sonnet
tools: Read, Grep, Glob, Edit, Bash
skills:
  - score-debug
memory: project
---

## Key Files
- `src/hooks/score/useAutoPipeline.ts` — 업로드/녹화 파이프라인
- `src/hooks/score/useLiveAutoPipeline.ts` — 라이브 VP 파이프라인
- `src/app/api/transcribe/route.ts` — Whisper 전사
- `src/app/api/collectEvidence/route.ts` — GPT-5.1 증거 수집 (Structured Output)
- `src/app/api/classifySections/route.ts` — 섹션 시간 분류
- `src/app/api/feedback/route.ts` — 피드백 생성
- `src/utils/loadChecklist.ts` — 체크리스트 로더
- `src/utils/score.ts` — 점수 유틸리티

## Debugging Strategy

### 1. 증상 파악
- 어떤 섹션에서 문제가 발생하는지 (history/physical_exam/education/ppi)
- 전체 0점인지, 특정 항목만 문제인지
- 에러 메시지 확인

### 2. 단계별 추적
1. **체크리스트 로드**: caseName이 loadChecklist switch문과 일치하는지
2. **전사**: S3에서 오디오를 정상적으로 가져왔는지, 전사 텍스트가 합리적인지
3. **증거 수집**: GPT-5.1 structured output이 정상인지, fallback이 동작했는지
4. **점수 계산**: evidence.length → point 변환 로직 확인

### 3. 수정 시 주의
- `useAutoPipeline.ts`와 `useLiveAutoPipeline.ts`는 유사하지만 다른 파일 — 둘 다 수정 필요한지 확인
- API route 수정 시 request/response DTO도 함께 업데이트
- Zod 스키마 변경 시 클라이언트 측 타입도 확인
