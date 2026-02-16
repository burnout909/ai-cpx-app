---
name: deploy
description: Vercel 배포 전 빌드 및 린트를 확인합니다.
disable-model-invocation: true
allowed-tools: Bash(npm:*), Bash(git:*)
---

# 배포 확인

## Usage
```
/deploy
```

## Steps

### 1. 린트 체크
```bash
npm run lint
```
- ESLint 에러가 있으면 수정 후 재실행

### 2. 빌드 확인
```bash
npm run build
```
- TypeScript 타입 에러, import 경로 문제 등 확인
- `next build`는 Turbopack 없이 실행됨 (production 모드)

### 3. 배포
- Vercel에 연결된 git 저장소에 push하면 자동 배포
- `main` 브랜치 push → production 배포
- 다른 브랜치 push → preview 배포

### 4. 배포 후 확인
- Vercel 대시보드에서 배포 상태 확인
- 빌드 로그에서 에러 없는지 확인
- 환경 변수가 올바르게 설정되어 있는지 확인 (Vercel 프로젝트 설정)

### 주의사항
- `.env.local`은 git에 포함되지 않으므로 Vercel 대시보드에서 별도 설정 필요
- Prisma 마이그레이션은 `npm run db:deploy`로 별도 실행
- S3 버킷 CORS 설정이 production 도메인을 허용하는지 확인
