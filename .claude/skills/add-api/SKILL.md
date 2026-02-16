---
name: add-api
description: 새로운 Next.js API 라우트를 프로젝트 패턴에 맞게 생성합니다.
disable-model-invocation: true
argument-hint: "<엔드포인트이름> [HTTP메서드]"
---

# API 라우트 추가

## Usage
```
/add-api <엔드포인트이름> [HTTP메서드]
```
예시: `/add-api generateReport POST`

## Steps

### 1. 라우트 파일 생성
- **경로**: `src/app/api/<엔드포인트이름>/route.ts`
- **참조**: `src/app/api/collectEvidence/route.ts`, `src/app/api/transcribe/route.ts`

### 2. 기본 구조

```typescript
import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";  // OpenAI 사용 시

// ── Request/Response DTOs ──
export interface <Name>Request {
  // 요청 필드
}

export interface <Name>Response {
  // 성공 응답 필드
}

export interface <Name>Error {
  detail: string;
}

// ── Route Handler ──
export async function POST(
  req: Request
): Promise<NextResponse<<Name>Response | <Name>Error>> {
  try {
    const payload = (await req.json()) as <Name>Request;

    // 입력 검증
    if (!payload.requiredField) {
      return NextResponse.json<<Name>Error>(
        { detail: "Invalid payload: requiredField is required." },
        { status: 400 }
      );
    }

    // 비즈니스 로직
    // ...

    return NextResponse.json<<Name>Response>({ /* 결과 */ });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<<Name>Error>(
      { detail: `<name> failed: ${msg}` },
      { status: 500 }
    );
  }
}
```

### 3. 공통 유틸리티 (`src/app/api/_lib.ts`)
- `getOpenAIKey()` - OpenAI API 키 가져오기
- `getOpenAIClient()` - OpenAI 클라이언트 인스턴스
- `extractTextFromResponses(resp)` - Responses/Chat API에서 텍스트 추출

### 4. 인증이 필요한 API
```typescript
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```

### 5. Admin API
- 경로: `src/app/api/admin/<이름>/route.ts`
- 반드시 admin 권한 체크 추가
- Prisma 사용 시: `import { prisma } from "@/lib/prisma"`

### 6. 검증
- `npm run build`로 타입 오류 확인
- 클라이언트에서 호출하는 코드도 함께 작성/수정
