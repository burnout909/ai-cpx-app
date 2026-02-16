# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 핵심 철학
- Think Before Coding (코드 타이핑 전에 생각부터): 가정 명시, 불확실하면 질문, 혼란 시 멈춤
- Simplicity First (단순하게 먼저): 요청 안 한 기능·추상화·에러 처리 추가 금지
- Surgical Changes (수술처럼 정밀하게): 요청된 부분만 바꾸고 나머지 건드리지 않기
- Goal-Driven Execution (목표 중심 실행): “기능 추가” 대신 “테스트 통과시키기”처럼 구체적 목표로 변환

## Project Overview

AI-CPX is a medical education platform for CPX (Clinical Performance Examination) practice and auto-grading. It enables medical students to practice clinical interviews with AI-powered virtual patients and receive automated scoring and feedback.

**Key features:**
- Live CPX practice with OpenAI Realtime API-based virtual patients
- Audio/video upload for recorded practice sessions
- Automated transcription (Whisper) and evidence-based scoring
- Narrative feedback generation using GPT models
- Student ID verification system with admin approval workflow
- Educational AI tutor chat (Socratic questioning approach)

## Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack
npm run dev:web      # Start dev server without Turbopack (use if Turbopack issues)
npm run build        # Production build (disables Turbopack)
npm run start        # Start production server
npm run lint         # Run ESLint

# Database (Prisma + Supabase)
npm run db:migrate   # Create and apply migrations (dev)
npm run db:push      # Push schema changes without migrations
npm run db:pull      # Pull schema from database
npm run db:studio    # Open Prisma Studio
npm run db:deploy    # Apply migrations (production)

# Supabase
npm run supabase:start   # Start local Supabase
npm run supabase:stop    # Stop local Supabase
npm run supabase:status  # Show status with env vars
```

## Architecture

### Route Groups (Next.js App Router)

- `(main)/` - Student-facing pages: home, live-select, record-select, upload-select, score
- `(auth)/` - Authentication pages: login, onboarding, policy pages
- `(admin)/` - Admin dashboard: student lookup, ID verifications, scenario generator

### Core Data Flow

1. **Live Practice** (`/live-select/cpx`):
   - Uses `@openai/agents/realtime` for real-time voice conversation
   - Virtual patient prompts built from JSON scenario files in `src/assets/virtualPatient/`
   - Audio recorded client-side, uploaded to S3 on session end

2. **Scoring Pipeline** (`/score`):
   - `useAutoPipeline` / `useLiveAutoPipeline` hooks orchestrate the flow
   - Transcription via `/api/transcribe` (Whisper)
   - Evidence collection via `/api/collectEvidence` (GPT-5.1 structured output)
   - Feedback generation via `/api/feedback` (GPT-4o-mini)
   - Results stored in S3 and tracked in Prisma

3. **Checklists**:
   - `src/assets/evidenceChecklist/` - Evidence criteria per medical case (Korean case names)
   - `src/assets/scoreChecklist/` - Scoring weights per checklist item
   - Loaded dynamically via `src/utils/loadChecklist.ts` switch statement

### Key Integrations

- **Supabase**: Auth (Google/Kakao OAuth), session management
- **Prisma**: PostgreSQL ORM, schema in `prisma/schema.prisma`
- **AWS S3**: Audio files, transcripts, student ID images, feedback/score JSON
- **OpenAI**: Whisper (transcription), GPT models (evidence/feedback), Realtime API (virtual patient)

### State Management

- Zustand store (`src/store/useUserStore.ts`) for client-side user state
- Server-side auth via `src/lib/supabase/server.ts` (cookie-based)

### Database Schema Highlights

- `Profile` - User info, links to Supabase auth.users via UUID
- `CpxSession` - Practice session (VP=virtual patient, SP=standardized patient)
- `Upload`, `Transcript`, `Feedback`, `Score` - Artifacts stored with S3 keys
- `StudentIdVerification` - Verification workflow (PENDING/APPROVED/REJECTED)

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL` or `DIRECT_URL` (Prisma PostgreSQL connection)
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_S3_BUCKET_NAME`, AWS credentials for S3

## Coding Conventions

### Naming
- **Components**: PascalCase (e.g., `ScoreCard.tsx`, `LiveSelectPage.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAutoPipeline.ts`, `useUserStore.ts`)
- **Utils**: camelCase (e.g., `loadChecklist.ts`, `loadVirtualPatient.ts`)
- **API routes**: camelCase directory name + `route.ts` (e.g., `collectEvidence/route.ts`)
- **Checklist files**: `evidenceChecklist_XX_englishName.ts`, `scoreChecklist_XX_englishName.ts`
- **VP files**: `english_name_NNN.json` (e.g., `acute_abdominal_pain_001.json`)

### Language
- **UI text, checklist criteria, case names**: Korean (한국어)
- **Code identifiers, file names, comments**: English
- **switch case keys in loadChecklist/loadVirtualPatient**: Korean case names (e.g., `"급성복통"`, `"호흡곤란"`)

### Component Patterns
- Client components: `"use client"` directive at top, use hooks for state/effects
- Server components: default (no directive), use `async` for data fetching
- API routes: export named HTTP method functions (`GET`, `POST`, etc.)

### Key Patterns

**API Route structure** (`src/app/api/*/route.ts`):
- Import `getOpenAIClient` from `../_lib` for OpenAI access
- Use `NextResponse.json<T>()` with typed response DTOs
- Define request/response interfaces in the same file
- Error handling: try/catch with typed error response

**Checklist loading** (`src/utils/loadChecklist.ts`):
- Switch on Korean case name → dynamic import of evidence + score modules
- Each module exports: `HistoryEvidenceChecklist`, `PhysicalexamEvidenceChecklist`, `EducationEvidenceChecklist`, `PpiEvidenceChecklist`
- Score modules export: `HistoryScoreChecklist`, `PhysicalExamScoreChecklist`, `EducationScoreChecklist`, `PpiScoreChecklist`

**Virtual Patient loading** (`src/utils/loadVirtualPatient.ts`):
- Switch on Korean case name → dynamic import of JSON + image + solution
- VP JSON structure: `id`, `title`, `description`, `meta` (patient info), `history`, `additional_history`, `physical_exam`, `questions`
- Each VP needs: `.json` (scenario), `.png` (profile image), `_solution.ts` (answer key)

**Scoring Pipeline** (`useAutoPipeline` / `useLiveAutoPipeline`):
- Flow: load checklist → transcribe audio (Whisper) → collect evidence (GPT-5.1) per section → classify sections → calculate grades
- Sections: `history`, `physical_exam`, `education`, `ppi`
- Evidence + classifySections run in parallel after transcription
- Results stored to S3 and tracked via metadata API

## Caveats

- **Turbopack issues**: Use `npm run dev:web` if Turbopack causes problems
- **S3 key structure**: `SP_audio/`, `SP_script/`, `VP_audio/` prefixes distinguish content types
- **Supabase auth cookies**: Server-side auth uses `src/lib/supabase/server.ts` with cookie-based sessions
- **Evidence checklist**: Some case-specific files include `example` field, base checklist does not — both patterns are valid
- **Score checklist**: `max_evidence_count` currently not used in grading (hardcoded to 1), but data structure is maintained for future use

## Deployment

- **Platform**: Vercel (auto-deploy on git push to main)
- **Build check**: Always run `npm run build` before pushing to verify no build errors
- **Environment**: Production env vars configured in Vercel dashboard

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json)

## SVG Imports

SVGs are imported as React components via `@svgr/webpack` (configured in next.config.ts).

```tsx
import PlayIcon from "@/assets/icon/PlayIcon.svg";
<PlayIcon className="w-6 h-6" />
```
