import { GradeItem } from "@/types/score";

export function sumPoints(list: GradeItem[]) {
    if (!Array.isArray(list)) return { got: 0, max: 0 };
    return list.reduce(
        (acc, g) => ({
            got: acc.got + g.point,
            max: acc.max + g.max_evidence_count,
        }),
        { got: 0, max: 0 }
    );
}


export function getAllTotals(gradesBySection: Record<string, GradeItem[]>) {
    const totals = Object.fromEntries(
        Object.entries(gradesBySection).map(([k, v]) => [k, sumPoints(v)])
    );
    const overall = Object.values(totals).reduce(
        (acc, cur) => ({ got: acc.got + cur.got, max: acc.max + cur.max }),
        { got: 0, max: 0 }
    );
    return { totals, overall };
}

export async function readJsonOrText(res: Response): Promise<any> {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await res.json().catch(() => ({}));
    return await res.text().catch(() => '');
}

export async function ensureOkOrThrow(res: Response, data: any) {
    if (!res.ok) {
        const msg = typeof data === 'string' ? data : data?.message || res.statusText;
        throw new Error(msg);
    }
}