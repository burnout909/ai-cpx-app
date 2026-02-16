---
name: api-conventions
description: API route.ts 파일 작성 시 자동으로 참조되는 코딩 규칙입니다. API 엔드포인트를 생성하거나 수정할 때 사용합니다.
user-invocable: false
---

# API 코딩 규칙

## Rules

### 파일 구조
- 각 API 엔드포인트는 `src/app/api/<name>/route.ts`에 위치
- 공유 유틸리티는 `src/app/api/_lib.ts`에 정의
- Request/Response 타입은 route.ts 파일 내부에 `export interface`로 정의

### 에러 핸들링
- 모든 route handler는 try/catch로 감싸기
- 에러 응답 형식: `{ detail: string }` with 적절한 HTTP status
- 400: 잘못된 입력, 401: 인증 실패, 500: 서버 에러
- 에러 메시지에 함수명 포함: `"<endpointName> failed: ${msg}"`

### 인증 체크
- 공개 API: 인증 불필요 (config, realtime-key 등)
- 사용자 API: Supabase `getUser()` 체크
- Admin API: Supabase user + admin role 확인

### 응답 포맷
- `NextResponse.json<T>(data, { status })` 사용
- 타입 파라미터로 응답 타입 명시
- 성공 시 status 생략 (기본 200)

### OpenAI 사용
- `getOpenAIClient()` from `../_lib` 사용
- Structured Output: Zod 스키마 + `zodTextFormat` 패턴
- Fallback 패턴: GPT-5.1 실패 시 GPT-4o-mini로 retry
- `response_format: { type: "json_object" }` for fallback

### 명명 규칙
- 엔드포인트 디렉토리: camelCase (`collectEvidence`, `classifySections`)
- DTO 인터페이스: PascalCase + 접미사 (`CollectEvidenceRequest`, `CollectEvidenceResponse`, `CollectEvidenceError`)
- 내부 헬퍼 함수: camelCase (`normalizeTranscriptToText`)
