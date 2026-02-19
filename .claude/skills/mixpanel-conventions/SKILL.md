---
name: mixpanel-conventions
description: Mixpanel 이벤트 트래킹 코드 작성 시 자동으로 참조되는 컨벤션입니다. track() 호출을 추가하거나 이벤트를 정의할 때 사용합니다.
user-invocable: false
---

# Mixpanel 트래킹 컨벤션

## SDK 구조

- 유틸리티: `src/lib/mixpanel.ts` — `track(event, properties)`, `identify(userId, props)`, `reset()`
- Provider: `src/component/MixpanelProvider.tsx` — 앱 루트에서 init + auth 연동
- 환경변수: `NEXT_PUBLIC_MIXPANEL_TOKEN`

## 이벤트 네이밍

- **형식**: `snake_case` (소문자 + 언더스코어)
- **구조**: `<domain>_<action>` (예: `cpx_session_start`, `score_completed`)
- **도메인 접두사**:
  - `page_` — 페이지 관련 (page_view 등)
  - `cpx_` — CPX 세션 관련 (cpx_session_start, cpx_session_end)
  - `vp_` — 가상환자 대화 (vp_conversation_start, vp_message_sent)
  - `score_` — 채점 관련 (score_started, score_completed)
  - `upload_` — 업로드 관련 (upload_started, upload_completed)
  - `auth_` — 인증 관련 (auth_login, auth_logout)
  - `admin_` — 관리자 기능 (admin_verification_approved)

## 프로퍼티 가이드라인

- 프로퍼티 키도 `snake_case` 사용
- 타입 안전: `Record<string, unknown>` 타입으로 전달
- 공통 프로퍼티 예시:
  - `case_name` — 케이스 한국어 이름
  - `session_type` — "VP" | "SP"
  - `section` — "history" | "physical_exam" | "education" | "ppi"
  - `duration_ms` — 소요 시간 (밀리초)

## 사용 패턴

```tsx
import { track } from "@/lib/mixpanel";

// 이벤트 트래킹
track("cpx_session_start", {
  case_name: "급성복통",
  session_type: "VP",
});
```

## 주의사항

- 서버 컴포넌트에서는 `track()` 호출 불가 — 클라이언트 컴포넌트에서만 사용
- `"use client"` 컴포넌트 또는 이벤트 핸들러 내에서 호출
- 개인정보(이름, 학번 등)는 프로퍼티에 직접 넣지 않기 — `identify()`로만 연동
