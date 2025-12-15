import { NextResponse } from 'next/server';
import s3 from '@/lib/s3';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;

type StructuredScores = Record<string, any[]>;
type VersionItem = { key: string; lastModified: number };

// S3의 LastModified가 비어있을 때를 대비해 파일명에 포함된 타임스탬프를 파싱한다.
const parseTimestampFromKey = (key: string): number | null => {
    const m = key.match(/-(\d{4}-\d{2}-\d{2})[_T](\d{2})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, date, hh, mm, ss] = m;
    const iso = `${date}T${hh}:${mm}:${ss}+09:00`;
    const ts = Date.parse(iso);
    return Number.isNaN(ts) ? null : ts;
};

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

async function listKeys(prefix: string, allowedExts?: string[]): Promise<VersionItem[]> {
    if (!BUCKET) return [];
    const res = await s3.send(
        new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
        })
    );
    const items =
        res.Contents?.filter((c) => {
            if (!c.Key) return false;
            if (!allowedExts?.length) return true;
            return allowedExts.some((ext) => c.Key!.toLowerCase().endsWith(ext.toLowerCase()));
        }).map((c) => ({
            key: c.Key!,
            lastModified: (() => {
                const direct = c.LastModified?.getTime();
                if (typeof direct === 'number' && !Number.isNaN(direct) && direct > 0) return direct;
                return parseTimestampFromKey(c.Key!) ?? 0;
            })(),
        })) || [];
    return items.sort((a, b) => b.lastModified - a.lastModified);
}

async function readObjectText(key: string) {
    if (!BUCKET) return '';
    const res = await s3.send(
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    );
    return streamToString(res.Body);
}

async function loadNarrative(key: string) {
    if (!key) return null;
    const raw = await readObjectText(key);
    try {
        const parsed = JSON.parse(raw);
        return parsed;
    } catch {
        return { content: raw };
    }
}

async function loadStructuredScores(key: string): Promise<StructuredScores | null> {
    if (!key) return null;
    const raw = await readObjectText(key);
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

        const [
            vpScripts,
            vpNarratives,
            vpStructureds,
            spScripts,
            spNarratives,
            spStructureds,
            spAudios,
        ] = await Promise.all([
            listKeys(`VP_script/${studentNumber}-`, ['.txt']),
            listKeys(`VP_narrative/${studentNumber}-`, ['.json', '.txt']),
            listKeys(`VP_structuredScore/${studentNumber}-`, ['.json']),
            listKeys(`SP_script/${studentNumber}-`, ['.txt']),
            listKeys(`SP_narrative/${studentNumber}-`, ['.json', '.txt']),
            listKeys(`SP_structuredScore/${studentNumber}-`, ['.json']),
            listKeys(`SP_audio/${studentNumber}-`, ['.mp3']),
        ]);

        const pickLatestKey = (arr: VersionItem[]) => arr[0]?.key || null;

        const vpScriptKey = pickLatestKey(vpScripts);
        const vpNarrativeKey = pickLatestKey(vpNarratives);
        const vpStructuredKey = pickLatestKey(vpStructureds);

        const spScriptKey = pickLatestKey(spScripts);
        const spNarrativeKey = pickLatestKey(spNarratives);
        const spStructuredKey = pickLatestKey(spStructureds);
        const spAudioKey = pickLatestKey(spAudios);

        const [vpScriptText, vpNarrative, vpStructured, spScriptText, spNarrative, spStructured] =
            await Promise.all([
                vpScriptKey ? readObjectText(vpScriptKey) : Promise.resolve(null),
                vpNarrativeKey ? loadNarrative(vpNarrativeKey) : Promise.resolve(null),
                vpStructuredKey ? loadStructuredScores(vpStructuredKey) : Promise.resolve(null),
                spScriptKey ? readObjectText(spScriptKey) : Promise.resolve(null),
                spNarrativeKey ? loadNarrative(spNarrativeKey) : Promise.resolve(null),
                spStructuredKey ? loadStructuredScores(spStructuredKey) : Promise.resolve(null),
            ]);

        // group by date (YYYY-MM-DD) for chip selection
        const toDateKey = (ts: number) => new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(ts); // "2025-03-01"

        const groupByDate = (versions: VersionItem[]) => {
            const map: Record<string, VersionItem[]> = {};
            versions.forEach((v) => {
                const ts = v.lastModified || parseTimestampFromKey(v.key) || 0;
                const dateKey = toDateKey(ts);
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
