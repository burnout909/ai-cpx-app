# Mixpanel 이벤트 트래킹 추가 플랜

## Context
유저 플로우(`.claude/docs/user-flow.png`) 기반으로 로그인/온보딩, 가상환자(Live), 녹음(Record) 3개 플로우에 Mixpanel 이벤트를 심는다. 컨텍스트 오버플로우 방지를 위해 3단계로 나누어 작업한다.

---

## 이벤트 스펙

### Stage 1: 인증/온보딩 플로우 (3개 파일)

| 파일 | 트리거 | 이벤트명 | 프로퍼티 |
|---|---|---|---|
| `LoginClient.tsx` | OAuth 버튼 클릭 | `auth_login_clicked` | `provider` |
| `LoginClient.tsx` | OAuth 에러 | `auth_login_error` | `provider`, `error` |
| `AuthCallbackClient.tsx` | 로그인 성공 → 홈 이동 | `auth_login_completed` | — |
| `AuthCallbackClient.tsx` | 프로필 미등록 → 온보딩 이동 | `auth_onboarding_redirected` | — |
| `AuthCallbackClient.tsx` | OAuth 에러 | `auth_oauth_error` | `error` |
| `onboarding/page.tsx` | 등록 버튼 클릭 | `auth_onboarding_submitted` | — |
| `onboarding/page.tsx` | 등록 성공 | `auth_onboarding_completed` | — |
| `onboarding/page.tsx` | 등록 에러 | `auth_onboarding_error` | `error` |

### Stage 2: 가상환자(Live) 플로우 (4개 파일)

| 파일 | 트리거 | 이벤트명 | 프로퍼티 |
|---|---|---|---|
| `home/page.tsx` | "가상환자와 실습하기" 클릭 | `home_cta_clicked` | `destination: "live"` |
| `home/page.tsx` | "녹음 후 채점 받기" 클릭 | `home_cta_clicked` | `destination: "record"` |
| `live-select/page.tsx` | 케이스 선택 완료 + 시작 | `live_practice_started` | `category`, `case_name` |
| `LiveCPXClient.tsx` | 세션 시작 (connect 성공) | `vp_session_started` | `case_name` |
| `LiveCPXClient.tsx` | 세션 종료 (수동/타임아웃) | `vp_session_ended` | `case_name`, `duration_sec` |
| `LiveCPXClient.tsx` | S3 업로드 + 채점 이동 | `vp_submitted` | `case_name`, `session_id` |
| `ScoreClient.tsx` | 채점 완료 | `score_completed` | `case_name`, `origin`, `session_id` |
| `ScoreClient.tsx` | "해설 보기" 토글 | `score_solution_toggled` | `case_name` |

### Stage 3: 녹음(Record) 플로우 (2개 파일)

| 파일 | 트리거 | 이벤트명 | 프로퍼티 |
|---|---|---|---|
| `record-select/page.tsx` | 케이스 선택 + 시작 | `record_practice_started` | `category`, `case_name` |
| `RecordCPXClient.tsx` | 녹음 시작 | `record_session_started` | `case_name` |
| `RecordCPXClient.tsx` | 녹음 일시정지 | `record_session_paused` | `case_name` |
| `RecordCPXClient.tsx` | 녹음 재개 | `record_session_resumed` | `case_name` |
| `RecordCPXClient.tsx` | 녹음 종료 + 채점 제출 | `record_submitted` | `case_name`, `session_id` |

> `ScoreClient.tsx`의 `score_completed`는 Stage 2에서 이미 추가되므로 Record에서도 동일하게 동작한다 (origin 프로퍼티로 구분).

---

## 수정 대상 파일 (총 9개)

### Stage 1 — 인증/온보딩
| 파일 | 경로 |
|---|---|
| LoginClient | `src/app/(auth)/login/LoginClient.tsx` |
| AuthCallbackClient | `src/app/(auth)/auth/callback/AuthCallbackClient.tsx` |
| Onboarding | `src/app/(auth)/onboarding/page.tsx` |

### Stage 2 — 홈 + 가상환자 + 채점
| 파일 | 경로 |
|---|---|
| Home | `src/app/(main)/home/page.tsx` |
| LiveSelect | `src/app/(main)/live-select/page.tsx` |
| LiveCPXClient | `src/app/(main)/live-select/cpx/LiveCPXClient.tsx` |
| ScoreClient | `src/app/(main)/score/ScoreClient.tsx` |

### Stage 3 — 녹음
| 파일 | 경로 |
|---|---|
| RecordSelect | `src/app/(main)/record-select/page.tsx` |
| RecordCPXClient | `src/app/(main)/record-select/cpx/RecordCPXClient.tsx` |

---

## 작업 방법

각 Stage마다:
1. `import { track } from "@/lib/mixpanel"` 추가
2. 기존 이벤트 핸들러 내부에 `track()` 호출 1줄 삽입
3. 기존 로직은 변경하지 않음

`src/lib/mixpanel.ts`의 `track()` 함수 재사용 — 신규 유틸리티 불필요.

---

## 검증

1. `npm run build` — 빌드 에러 없는지 확인
2. `npm run dev:web` → 각 플로우 수행하며 브라우저 콘솔에서 Mixpanel debug 로그 확인
   - 로그인 → 온보딩 → 홈 → 가상환자 시작/종료 → 채점
   - 홈 → 녹음 시작/일시정지/제출 → 채점
