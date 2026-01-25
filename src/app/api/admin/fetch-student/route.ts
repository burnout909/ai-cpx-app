import { NextResponse } from 'next/server';
import s3 from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;

type StructuredScores = Record<string, any[]>;
type VersionItem = { key: string; lastModified: number };

async function streamToString(body: any) {
    if (!body) return '';
    if (typeof body.transformToString === 'function') {
        return body.transformToString('utf-8');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

async function readObjectText(key: string) {
    if (!BUCKET) return '';
    try {
        const res = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );
        return streamToString(res.Body);
    } catch (err) {
        console.warn('[readObjectText failed]', key, err);
        return '';
    }
}

async function loadNarrative(key: string) {
    if (!key) return null;
    const raw = await readObjectText(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return { content: raw };
    }
}

async function loadStructuredScores(key: string): Promise<StructuredScores | null> {
    if (!key) return null;
    const raw = await readObjectText(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn('[structuredScore parse failed]', err);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        if (!BUCKET) {
            return NextResponse.json({ error: 'S3 bucket is not configured' }, { status: 500 });
        }
        const body = await req.json().catch(() => ({}));
        const studentNumber = body.studentNumber as string | undefined;
        if (!studentNumber) {
            return NextResponse.json({ error: 'studentNumber is required' }, { status: 400 });
        }

        // 1. studentNumber로 Profile 조회
        const profile = await prisma.profile.findFirst({
            where: { studentNumber },
            select: { id: true },
        });

        if (!profile) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. userId로 Transcript, Score, Upload 조회
        const [transcripts, scores, uploads] = await Promise.all([
            prisma.transcript.findMany({
                where: { userId: profile.id },
                orderBy: { createdAt: 'desc' },
                select: {
                    s3Key: true,
                    origin: true,
                    createdAt: true,
                },
            }),
            prisma.score.findMany({
                where: { userId: profile.id },
                orderBy: { createdAt: 'desc' },
                select: {
                    s3Key: true,
                    origin: true,
                    createdAt: true,
                },
            }),
            prisma.upload.findMany({
                where: { userId: profile.id },
                orderBy: { createdAt: 'desc' },
                select: {
                    s3Key: true,
                    origin: true,
                    type: true,
                    createdAt: true,
                },
            }),
        ]);

        // 3. VP/SP로 분류
        const toVersionItem = (item: { s3Key: string; createdAt: Date }): VersionItem => ({
            key: item.s3Key,
            lastModified: item.createdAt.getTime(),
        });

        const vpScripts = transcripts.filter(t => t.origin === 'VP').map(toVersionItem);
        const spScripts = transcripts.filter(t => t.origin === 'SP').map(toVersionItem);
        const vpStructureds = scores.filter(s => s.origin === 'VP').map(toVersionItem);
        const spStructureds = scores.filter(s => s.origin === 'SP').map(toVersionItem);
        const spAudios = uploads.filter(u => u.origin === 'SP' && u.type === 'AUDIO').map(toVersionItem);

        // Narrative는 Feedback 테이블에서 (유지 - 기존 데이터 호환)
        const feedbacks = await prisma.feedback.findMany({
            where: { userId: profile.id },
            orderBy: { createdAt: 'desc' },
            select: {
                s3Key: true,
                origin: true,
                createdAt: true,
            },
        });
        const vpNarratives = feedbacks.filter(f => f.origin === 'VP').map(toVersionItem);
        const spNarratives = feedbacks.filter(f => f.origin === 'SP').map(toVersionItem);

        const pickLatestKey = (arr: VersionItem[]) => arr[0]?.key || null;

        const vpScriptKey = pickLatestKey(vpScripts);
        const vpNarrativeKey = pickLatestKey(vpNarratives);
        const vpStructuredKey = pickLatestKey(vpStructureds);

        const spScriptKey = pickLatestKey(spScripts);
        const spNarrativeKey = pickLatestKey(spNarratives);
        const spStructuredKey = pickLatestKey(spStructureds);
        const spAudioKey = pickLatestKey(spAudios);

        // 4. 최신 데이터 로드
        const [vpScriptText, vpNarrative, vpStructured, spScriptText, spNarrative, spStructured] =
            await Promise.all([
                vpScriptKey ? readObjectText(vpScriptKey) : Promise.resolve(null),
                vpNarrativeKey ? loadNarrative(vpNarrativeKey) : Promise.resolve(null),
                vpStructuredKey ? loadStructuredScores(vpStructuredKey) : Promise.resolve(null),
                spScriptKey ? readObjectText(spScriptKey) : Promise.resolve(null),
                spNarrativeKey ? loadNarrative(spNarrativeKey) : Promise.resolve(null),
                spStructuredKey ? loadStructuredScores(spStructuredKey) : Promise.resolve(null),
            ]);

        // 5. 날짜별 그룹화
        const toDateKey = (ts: number) => new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(ts);

        const groupByDate = (versions: VersionItem[]) => {
            const map: Record<string, VersionItem[]> = {};
            versions.forEach((v) => {
                const dateKey = toDateKey(v.lastModified);
                if (!map[dateKey]) map[dateKey] = [];
                map[dateKey].push(v);
            });
            return map;
        };

        return NextResponse.json({
            vp: {
                script: { latestKey: vpScriptKey, latestText: vpScriptText, latest: vpScriptText, versions: vpScripts, byDate: groupByDate(vpScripts) },
                narrative: { latestKey: vpNarrativeKey, latest: vpNarrative, versions: vpNarratives, byDate: groupByDate(vpNarratives) },
                structured: { latestKey: vpStructuredKey, latest: vpStructured, versions: vpStructureds, byDate: groupByDate(vpStructureds) },
            },
            sp: {
                script: { latestKey: spScriptKey, latestText: spScriptText, latest: spScriptText, versions: spScripts, byDate: groupByDate(spScripts) },
                narrative: { latestKey: spNarrativeKey, latest: spNarrative, versions: spNarratives, byDate: groupByDate(spNarratives) },
                structured: { latestKey: spStructuredKey, latest: spStructured, versions: spStructureds, byDate: groupByDate(spStructureds) },
                audio: { latestKey: spAudioKey, versions: spAudios, byDate: groupByDate(spAudios) },
            },
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err?.message || 'Failed to load student data' }, { status: 500 });
    }
}
