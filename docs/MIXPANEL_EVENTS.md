# Mixpanel 이벤트 정의서

모든 페이지에서 사용하는 Mixpanel 이벤트를 페이지별로 정리한 문서입니다.

---

## 공통

모든 페이지(admin 제외)에 적용되는 이벤트입니다.

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `page_view` | 페이지 접속 | `{ page }` |
| `page_leave` | 페이지 이탈 | `{ page, duration_ms }` |

> `page` 값 목록: `home`, `live_select`, `live_cpx`, `record_select`, `record_cpx`, `upload_select`, `upload_cpx`, `score`, `history`, `login`, `onboarding`, `privacy_policy`, `terms`

> `score` 페이지는 추가로 `{ origin: "VP" | "SP" | "History" }` 포함

---

## /home

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `home_cta_clicked` | 메뉴 버튼 클릭 | `{ destination: "live" \| "record" \| "history" }` |

---

## /live-select

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `live_select_clicked` | 분류 선택 | `{ class, dx: "", case: "" }` |
| `live_select_clicked` | 주호소 선택 | `{ class, dx, case: "" }` |
| `live_select_clicked` | 케이스 선택 | `{ class, dx, case }` |
| `live_cta_clicked` | 실습 시작하기 클릭 | `{ class, dx, case }` |

---

## /live-select/cpx (가상환자 실습)

### 인스트럭션 팝업

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `instruction` | 다음 버튼 | `{ destination: "step2" \| "step3" \| "step4" }` |
| `instruction` | 이전 버튼 | `{ destination: "step1" \| "step2" \| "step3" }` |
| `instruction` | 시작하기 버튼 | `{ action: "start" }` |
| `instruction` | 다시 보지 않기 체크 | `{ action: "donotseeagain" }` |

### 실습 진행

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `mic_permission` | 마이크 허용/거부 | `{ allowed: true \| false }` |
| `vp_start` | 실습 시작 (마이크 연결 후) | `{ case_name, ready_duration_ms }` |
| `focus_mode` | 집중모드 설정 | `{ action: "enable" }` |
| `focus_mode` | 집중모드 해제 | `{ action: "disable" }` |
| `vp_session_ended` | 종료 및 채점 | `{ case_name, duration_sec, duration_display, total_turns, user_turns, assistant_turns, avg_turn_gap_sec }` |
| `vp_submitted` | S3 업로드 완료 후 채점 이동 | `{ case_name, session_id }` |
| `auth_blocked` | 인증 미완료로 차단 | `{ reason: "missing" \| "rejected" \| "pending", page: "live_cpx" }` |

---

## /record-select

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `record_select_clicked` | 분류 선택 | `{ class, dx: "" }` |
| `record_select_clicked` | 주호소 선택 | `{ class, dx }` |
| `record_cta_clicked` | 실습 시작하기 클릭 | `{ class, dx }` |

---

## /record-select/cpx (녹음 실습)

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `mic_permission` | 마이크 허용/거부 | `{ allowed: true \| false }` |
| `record_start` | 녹음 시작 | `{ case_name, use_ready_timer, set_duration_sec, ready_duration_ms }` |
| `record_session_paused` | 일시정지 | `{ case_name }` |
| `record_session_resumed` | 재개 | `{ case_name }` |
| `focus_mode` | 집중모드 설정 | `{ action: "enable" }` |
| `focus_mode` | 집중모드 해제 | `{ action: "disable" }` |
| `record_submitted` | 종료 및 채점 | `{ case_name, session_id, duration_sec, duration_display }` |
| `auth_blocked` | 인증 미완료로 차단 | `{ reason: "missing" \| "rejected" \| "pending", page: "record_cpx" }` |

---

## /score (채점 결과)

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `score_completed` | 채점 완료 | `{ case_name, origin, session_id, score_duration_ms }` |
| `score_section_clicked` | 섹션 버튼 클릭 | `{ section, origin }` |
| `score_filter_clicked` | 전체/정답/오답 필터 | `{ section, filter, origin }` |
| `score_item_toggled` | 체크리스트 항목 토글 | `{ section, title, action: "expand" \| "collapse", origin }` |
| `score_solution_toggled` | 해설/채점결과 전환 | `{ case_name, origin }` |
| `score_next_practice_clicked` | 채점 중 다음 실습 버튼 클릭 | `{ case_name, origin, target }` |

> `origin`: `"VP"` (가상환자) \| `"SP"` (녹음본)
> `target`: `"VP"` (가상환자와 실습하기) \| `"SP"` (표준화환자와 실습하기)
> `section`: `"병력 청취"` \| `"신체 진찰"` \| `"환자 교육"` \| `"환자-의사관계"`
> `filter`: `"전체"` \| `"정답"` \| `"오답"`

---

## /history (학습 기록)

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `history_case_filter` | 주호소 드롭다운 선택 | `{ case_name }` |
| `history_origin_filter` | 실습 유형 칩 클릭 | `{ filter: "전체" \| "녹음본" \| "가상환자" }` |
| `history_date_filter` | 날짜 칩 클릭 | `{ filter: "전체" \| "최근 1주" \| "최근 1개월" }` |
| `history_session_clicked` | 세션 카드 클릭 | `{ session_id, case_name, origin }` |

---

## /login

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `auth_login_clicked` | 로그인 버튼 클릭 | `{ provider }` |
| `auth_login_error` | 로그인 실패 | `{ provider, error }` |
| `auth_login_completed` | 로그인 성공 (콜백) | - |
| `auth_oauth_error` | OAuth 에러 (콜백) | `{ error }` |
| `auth_onboarding_redirected` | 온보딩 미완료 리다이렉트 | - |

---

## /onboarding (학생증 인증)

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `onboarding_name_entered` | 이름 입력 완료 (blur) | - |
| `onboarding_student_number_entered` | 학번 입력 완료 (blur) | - |
| `onboarding_id_image_selected` | 학생증 이미지 선택 | - |
| `auth_onboarding_submitted` | 등록하기 클릭 | - |
| `auth_onboarding_completed` | 등록 성공 | - |
| `auth_onboarding_error` | 등록 실패 | `{ error }` |

---

## 문의하기 (FloatingInquiryLauncher, 전역)

| 이벤트 | 시점 | 프로퍼티 |
|--------|------|----------|
| `inquiry_opened` | 문의 버튼 클릭 (열기) | - |
| `inquiry_closed` | 닫기 (X/오버레이/토글) | - |
| `inquiry_tab_clicked` | 탭 전환 | `{ tab: "새 문의" \| "내 문의 내역" }` |
| `inquiry_submitted` | 문의 제출 성공 | - |

---

## SDK 구조

- **유틸리티**: `src/lib/mixpanel.ts` — `track(event, properties)`, `identify(userId, props)`, `reset()`
- **Provider**: `src/component/MixpanelProvider.tsx` — 앱 루트에서 init + auth 연동
- **페이지 트래킹 훅**: `src/hooks/usePageTracking.ts` — `page_view` / `page_leave` 자동 처리
- **서버 컴포넌트용**: `src/component/PageTracker.tsx` — 서버 페이지에 삽입하는 클라이언트 컴포넌트

## 네이밍 규칙

- 이벤트명: `snake_case` (예: `score_section_clicked`)
- 프로퍼티 키: `snake_case` (예: `case_name`, `duration_ms`)
- 도메인 접두사: `page_`, `home_`, `live_`, `record_`, `score_`, `history_`, `auth_`, `inquiry_`, `vp_`, `focus_`
