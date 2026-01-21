# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json)

## SVG Imports

SVGs are imported as React components via `@svgr/webpack` (configured in next.config.ts).

```tsx
import PlayIcon from "@/assets/icon/PlayIcon.svg";
<PlayIcon className="w-6 h-6" />
```
