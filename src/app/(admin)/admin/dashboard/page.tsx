'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Spinner from '@/component/Spinner';
import { GradeItem } from '@/types/score';
import { getAllTotals } from '@/utils/score';
import SearchIcon from '@/assets/icon/SearchIcon.svg';
import AdminNarrativeFeedbackView from '@/component/admin/AdminNarrativeFeedbackView';
import AdminReportDetailTable from '@/component/admin/AdminReportDetail';
import AdminReportSummary from '@/component/admin/AdminReportSummary';

type StructuredScores = Record<string, GradeItem[]>;
type VersionItem = { key: string; lastModified: number };
type DateMap = Record<string, VersionItem[]>;

interface ArtifactGroup<T> {
    latestKey: string | null;
    versions: VersionItem[];
    latest: T;
    byDate: DateMap;
}

interface ScriptGroup {
    latestKey: string | null;
    versions: VersionItem[];
    latestText: string | null;
    byDate: DateMap;
    latest?: string | null; // alias to satisfy shared helpers
}

interface ApiResponse {
    vp: {
        script: ScriptGroup;
        narrative: ArtifactGroup<any>;
        structured: ArtifactGroup<StructuredScores | null>;
    };
    sp: {
        script: ScriptGroup;
        narrative: ArtifactGroup<any>;
        structured: ArtifactGroup<StructuredScores | null>;
        audio: { latestKey: string | null; versions: VersionItem[]; byDate: DateMap };
    };
}
type StudentArtifacts = {
    script: ScriptGroup;
    narrative: ArtifactGroup<any>;
    structured: ArtifactGroup<StructuredScores | null>;
    audio?: { latestKey: string | null; versions: VersionItem[]; byDate: DateMap };
};

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
const PART_LABEL = { history: '병력 청취', physical_exam: '신체 진찰', education: '환자 교육', ppi: '환자-의사관계' };
const PRIMARY = '#7553FC';

export default function AdminDashboardPage() {
    const [isAuthed, setIsAuthed] = useState(false);
    const [password, setPassword] = useState('');
    const [studentNumber, setStudentNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [vpActiveSection, setVpActiveSection] = useState<string>('history');
    const [spActiveSection, setSpActiveSection] = useState<string>('history');
    const [vpDateKey, setVpDateKey] = useState<string | null>(null);
    const [spDateKey, setSpDateKey] = useState<string | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<{
        vp: { script: string | null; narrative: string | null; structured: string | null; audio: string | null };
        sp: { script: string | null; narrative: string | null; structured: string | null; audio: string | null };
    }>({
        vp: { script: null, narrative: null, structured: null, audio: null },
        sp: { script: null, narrative: null, structured: null, audio: null },
    });
    const [contentCache, setContentCache] = useState<Record<string, { text?: string; json?: any }>>({});

    const vpStructured = data?.vp?.structured?.latest || null;
    const spStructured = data?.sp?.structured?.latest || null;

    useEffect(() => {
        if (vpStructured) {
            const first = Object.keys(vpStructured)[0];
            if (first) setVpActiveSection(first);
        }
        if (data?.vp?.script?.versions?.[0]) {
            const dk = Object.keys(data.vp.script.byDate)[0];
            setVpDateKey(dk || null);
            setSelectedKeys((prev) => ({
                ...prev,
                vp: {
                    script: data.vp.script.byDate[dk]?.[0]?.key || data.vp.script.latestKey,
                    narrative: data.vp.narrative.byDate[dk]?.[0]?.key || data.vp.narrative.latestKey,
                    structured: data.vp.structured.byDate[dk]?.[0]?.key || data.vp.structured.latestKey,
                    audio: null,
                }
            }));
        }
    }, [vpStructured, data?.vp]);

    useEffect(() => {
        if (spStructured) {
            const first = Object.keys(spStructured)[0];
            if (first) setSpActiveSection(first);
        }
        if (data?.sp?.script?.versions?.[0]) {
            const dk = Object.keys(data.sp.script.byDate)[0];
            setSpDateKey(dk || null);
            setSelectedKeys((prev) => ({
                ...prev,
                sp: {
                    script: data.sp.script.byDate[dk]?.[0]?.key || data.sp.script.latestKey,
                    narrative: data.sp.narrative.byDate[dk]?.[0]?.key || data.sp.narrative.latestKey,
                    structured: data.sp.structured.byDate[dk]?.[0]?.key || data.sp.structured.latestKey,
                    audio: data.sp.audio.byDate[dk]?.[0]?.key || data.sp.audio.latestKey,
                }
            }));
        }
    }, [spStructured, data?.sp]);

    const handleAuth = (e: FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthed(true);
            setError(null);
        } else {
            setIsAuthed(false);
            setError('비밀번호가 올바르지 않습니다.');
        }
    };

    const handleFetch = async (e: FormEvent) => {
        e.preventDefault();
        if (!studentNumber.trim()) {
            setError('studentNumber를 입력하세요.');
            return;
        }
        setError(null);
        setLoading(true);
        setData(null);
        try {
            const res = await fetch('/api/admin/fetch-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentNumber: studentNumber.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || '불러오기 실패');
            }
            setData(json);
            setContentCache({});
            setSelectedKeys({
                vp: { script: null, narrative: null, structured: null, audio: null },
                sp: { script: null, narrative: null, structured: null, audio: null },
            });
            setVpDateKey(null);
            setSpDateKey(null);
        } catch (err: any) {
            setError(err?.message || '불러오기 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadKey = async (key: string) => {
        try {
            setDownloadLoading(true);
            const res = await fetch('/api/admin/download-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || 'URL 생성 실패');
            }
            window.open(json.url, '_blank', 'noopener');
        } catch (err: any) {
            setError(err?.message || '다운로드에 실패했습니다.');
        } finally {
            setDownloadLoading(false);
        }
    };

    useEffect(() => {
        const keysToLoad = [
            selectedKeys.vp.script,
            selectedKeys.vp.narrative,
            selectedKeys.vp.structured,
            selectedKeys.sp.script,
            selectedKeys.sp.narrative,
            selectedKeys.sp.structured,
        ].filter(Boolean) as string[];
        keysToLoad.forEach((k) => { void ensureContent(k); });
    }, [selectedKeys]);

    const formatTimestamp = (ts?: number) => {
        if (!ts) return '';
        return new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(ts);
    };

    const findTimestamp = (versions: VersionItem[], key?: string | null) => {
        if (!key) return '';
        const found = versions.find((v) => v.key === key);
        return found ? formatTimestamp(found.lastModified) : '';
    };

    const ensureContent = async (key: string | null) => {
        if (!key || contentCache[key]) return;
        try {
            const res = await fetch('/api/admin/download-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'URL 생성 실패');
            const fileRes = await fetch(json.url);
            const text = await fileRes.text();
            let parsed: any = null;
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = null;
            }
            setContentCache((prev) => ({ ...prev, [key]: parsed ? { json: parsed } : { text } }));
        } catch (err: any) {
            console.warn('[fetch content failed]', err);
        }
    };

    const renderStructuredBlock = (
        structured: StructuredScores | null,
        active: string,
        setActive: (s: string) => void,
        totals: ReturnType<typeof getAllTotals> | null
    ) => {
        if (!structured || !totals) return null;
        return (
            <div className="space-y-3 mt-2">
                <AdminReportSummary
                    totals={totals.totals}
                    overall={totals.overall}
                    active={active}
                    setActive={setActive}
                    PART_LABEL={PART_LABEL}
                />
                <AdminReportDetailTable grades={structured[active] || []} />
            </div>
        );
    };

    const renderNarrativeBlock = (narrative: any, origin: 'VP' | 'SP') => {
        if (!narrative) return null;
        return (
            <div className="mt-2">
                <AdminNarrativeFeedbackView studentNumber={studentNumber} feedback={narrative} origin={origin} />
            </div>
        );
    };

    const renderScriptBlock = (key?: string | null, text?: string | null, timestamp?: string) => {
        if (!key && !text) return (
            <div className="text-sm text-gray-500">데이터가 없습니다.</div>
        );
        return (
            <div className="space-y-1">
                {timestamp && <div className="text-[14px] text-gray-500">최근 기록: {timestamp}</div>}
                {text && (
                    <pre className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-[15px] text-gray-800 mt-1">
                        {text}
                    </pre>
                )}
            </div>
        );
    };

    const renderDateChips = (dates: string[], activeKey: string | null, onSelect: (d: string) => void) => {
        if (!dates.length) return null;
        return (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {dates.map((d) => {
                    const isActive = d === activeKey;
                    return (
                        <button
                            key={d}
                            onClick={() => onSelect(d)}
                            className="whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors"
                            style={{
                                borderColor: isActive ? PRIMARY : '#E5E7EB',
                                backgroundColor: isActive ? '#F4F0FF' : '#FFFFFF',
                                color: isActive ? PRIMARY : '#374151',
                            }}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
        );
    };

    const pickKeyForDate = (group: { latestKey: string | null; byDate: DateMap }, date: string | null) =>
        (date && group.byDate[date]?.[0]?.key) || group.latestKey;

    const applyDateSelection = (origin: 'vp' | 'sp', date: string | null) => {
        if (!data) return;
        if (origin === 'vp') {
            const source = data.vp;
            setSelectedKeys((prev) => ({
                ...prev,
                vp: {
                    script: pickKeyForDate(source.script, date),
                    narrative: pickKeyForDate(source.narrative, date),
                    structured: pickKeyForDate(source.structured, date),
                    audio: null,
                }
            }));
            setVpDateKey(date);
        } else {
            const source = data.sp;
            setSelectedKeys((prev) => ({
                ...prev,
                sp: {
                    script: pickKeyForDate(source.script, date),
                    narrative: pickKeyForDate(source.narrative, date),
                    structured: pickKeyForDate(source.structured, date),
                    audio: source.audio ? pickKeyForDate(source.audio, date) : null,
                }
            }));
            setSpDateKey(date);
        }
    };

    const renderSection = (
        label: string,
        origin: 'VP' | 'SP',
        artifacts: StudentArtifacts,
        active: string,
        setActive: (s: string) => void,
        showAudioButton?: boolean,
        dateKey?: string | null,
        onDateChange?: (k: string) => void
    ) => {
        const dateList = Object.keys(artifacts.script.byDate || {}).sort().reverse();
        const selectedDate = dateKey || dateList[0] || null;
        const pickFromDate = (group?: { latestKey: string | null; byDate: DateMap }) =>
            group ? ((selectedDate && group.byDate[selectedDate]?.[0]?.key) || null) : null;

        const selectedSet = origin === 'VP' ? selectedKeys.vp : selectedKeys.sp;
        const selectedScriptKey = selectedSet.script || pickFromDate(artifacts.script);
        const selectedNarrKey = selectedSet.narrative || pickFromDate(artifacts.narrative);
        const selectedStructKey = selectedSet.structured || pickFromDate(artifacts.structured);
        const selectedAudioKey = 'audio' in artifacts
            ? (selectedSet.audio || pickFromDate(artifacts.audio))
            : null;
        const scriptText =
            selectedScriptKey === artifacts.script.latestKey
                ? artifacts.script.latestText
                : (selectedScriptKey
                    ? contentCache[selectedScriptKey]?.text
                        ?? (contentCache[selectedScriptKey]?.json ? JSON.stringify(contentCache[selectedScriptKey]?.json, null, 2) : null)
                    : null);
        const narrativeData =
            selectedNarrKey === artifacts.narrative.latestKey
                ? artifacts.narrative.latest
                : (selectedNarrKey ? contentCache[selectedNarrKey]?.json || contentCache[selectedNarrKey]?.text : null);
        const structuredData =
            selectedStructKey === artifacts.structured.latestKey
                ? artifacts.structured.latest
                : (selectedStructKey ? contentCache[selectedStructKey]?.json || null : null);
        const computedTotals = structuredData ? getAllTotals(structuredData) : null;

        return (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
                    {showAudioButton && (
                        <button
                            onClick={() => selectedAudioKey && handleDownloadKey(selectedAudioKey)}
                            disabled={downloadLoading || !selectedAudioKey}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 transition-colors hover:brightness-95"
                            style={{ backgroundColor: PRIMARY, ...(downloadLoading ? {} : { cursor: 'pointer' }) }}
                        >
                            {downloadLoading ? '다운로드 중...' : 'SP 오디오 다운로드'}
                        </button>
                    )}
                </div>

                <div className="space-y-4 mt-3">
                    <div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">스크립트</h3>
                        {renderScriptBlock(
                            selectedScriptKey,
                            scriptText || (selectedScriptKey === artifacts.script.latestKey ? artifacts.script.latestText : null),
                            findTimestamp(artifacts.script.versions, selectedScriptKey)
                        )}
                    </div>

                    <div>
                    <h3 className="text-base font-semibold text-gray-700 mb-1">피드백</h3>
                    <div className="text-[14px] text-gray-500">
                        {findTimestamp(artifacts.narrative.versions, selectedNarrKey)}
                    </div>
                    {renderNarrativeBlock(
                        narrativeData,
                        origin
                    ) || <div className="text-[14px] text-gray-500">데이터가 없습니다.</div>}
                </div>

                    <div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">체크리스트</h3>
                        <div className="text-[14px] text-gray-500">
                            {findTimestamp(artifacts.structured.versions, selectedStructKey)}
                        </div>
                        {renderStructuredBlock(structuredData || null, active, setActive, computedTotals) || (
                            <div className="text-[14px] text-gray-500">데이터가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto flex w-full flex-col gap-6 px-16 py-10">
            {isAuthed && <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>}
            {!isAuthed ? (
                <div className="flex min-h-[60vh] items-center justify-center">
                    <form onSubmit={handleAuth} className="w-full max-w-md rounded-xl border border-gray-200 bg-white space-y-4 p-6">
                        <label className="block text-base font-medium text-gray-700">
                            관리자 비밀번호
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-3 w-full rounded-md border border-gray-300 px-4 py-3 text-sm focus:border-[var(--primary)] focus:outline-none transition-colors"
                                placeholder="비밀번호를 입력하세요"
                                style={{ ['--primary' as any]: PRIMARY }}
                            />
                        </label>
                        {error && <div className="text-sm text-red-600">{error}</div>}
                        <button
                            type="submit"
                            className="w-full rounded-md px-3 py-3 text-sm font-semibold text-white transition-colors hover:brightness-95"
                            style={{ backgroundColor: PRIMARY }}
                        >
                            로그인
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    <div className="rounded-xl bg-white px-5 pb-5">
                        <form onSubmit={handleFetch}>
                            <div
                                className="mt-3 flex items-center gap-3 rounded-full border border-gray-200 bg-white px-5 py-3 shadow-sm transition-colors focus-within:border-[var(--primary)]"
                                style={{ ['--primary' as any]: PRIMARY }}
                            >
                                <SearchIcon width={22} height={22} className="text-[var(--primary)]" />
                                <input
                                    type="text"
                                    value={studentNumber}
                                    onChange={(e) => setStudentNumber(e.target.value)}
                                    className="w-full bg-transparent text-base focus:outline-none"
                                    placeholder="조회할 학생의 학번을 입력하세요"
                                />
                            </div>
                        </form>

                        {data && (
                            <div className="mt-4">
                                <div className="text-base font-semibold text-gray-700 mb-2">날짜 선택</div>
                                {renderDateChips(
                                    Array.from(new Set([
                                        ...Object.keys(data.vp.script.byDate || {}),
                                        ...Object.keys(data.vp.narrative.byDate || {}),
                                        ...Object.keys(data.vp.structured.byDate || {}),
                                        ...Object.keys(data.sp.script.byDate || {}),
                                        ...Object.keys(data.sp.narrative.byDate || {}),
                                        ...Object.keys(data.sp.structured.byDate || {}),
                                        ...(data.sp.audio?.byDate ? Object.keys(data.sp.audio.byDate) : []),
                                    ])).sort().reverse(),
                                    vpDateKey || spDateKey,
                                    (d) => {
                                        applyDateSelection('vp', d);
                                        applyDateSelection('sp', d);
                                    }
                                )}
                            </div>
                        )}
                    </div>
                    {error && <div className="text-sm text-red-600">{error}</div>}

                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Spinner size={20} />
                            불러오는 중...
                        </div>
                    )}

                    {data && (
                        <div className="grid gap-4 md:grid-cols-2">
                            {renderSection('가상환자', 'VP', data.vp, vpActiveSection, setVpActiveSection, false, vpDateKey, (d) => applyDateSelection('vp', d))}
                            {renderSection('표준환자', 'SP', data.sp, spActiveSection, setSpActiveSection, true, spDateKey, (d) => applyDateSelection('sp', d))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
