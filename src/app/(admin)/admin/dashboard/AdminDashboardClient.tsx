'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
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
type AudioGroup = { baseKey: string; parts: VersionItem[] };
type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type VerificationItem = {
    id: string;
    status: VerificationStatus;
    s3Key: string;
    submittedAt: string;
    reviewedAt: string | null;
    rejectReason: string | null;
    user: { displayName: string | null; studentNumber: string | null; email: string | null };
    reviewer?: { displayName: string | null; email: string | null } | null;
};

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

const PART_LABEL = { history: '병력 청취', physical_exam: '신체 진찰', education: '환자 교육', ppi: '환자-의사관계' };
const PRIMARY = '#7553FC';

type DashboardMode = 'student' | 'verification';

export default function AdminDashboardClient({ mode = 'student' }: { mode?: DashboardMode }) {
    const showVerification = mode === 'verification';
    const showStudentLookup = mode === 'student';
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
    const [verificationList, setVerificationList] = useState<VerificationItem[]>([]);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
    const [updatingVerificationId, setUpdatingVerificationId] = useState<string | null>(null);

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

    const loadVerifications = async () => {
        setVerificationLoading(true);
        setVerificationError(null);
        try {
            const res = await fetch('/api/admin/id-verifications', {
                method: 'GET',
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || '불러오기 실패');
            }
            setVerificationList(json.items || []);
        } catch (err: any) {
            setVerificationError(err?.message || '불러오기 중 오류가 발생했습니다.');
        } finally {
            setVerificationLoading(false);
        }
    };

    const handleVerificationUpdate = async (id: string, status: VerificationStatus) => {
        const rejectReason = rejectReasons[id]?.trim() || '';
        if (status === 'REJECTED' && !rejectReason) {
            setVerificationError('거절 사유를 입력해주세요.');
            return;
        }
        setVerificationError(null);
        setUpdatingVerificationId(id);
        try {
            const res = await fetch('/api/admin/id-verifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id, status, rejectReason }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || '처리에 실패했습니다.');
            }
            setVerificationList((prev) =>
                prev.map((item) => (item.id === id ? json.item : item))
            );
        } catch (err: any) {
            setVerificationError(err?.message || '처리 중 오류가 발생했습니다.');
        } finally {
            setUpdatingVerificationId(null);
        }
    };

    useEffect(() => {
        if (showVerification) {
            void loadVerifications();
        }
    }, [showVerification]);

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
    const formatIso = (value?: string | null) =>
        value ? formatTimestamp(Date.parse(value)) : '';

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

    const versionsForDate = (group: { byDate: DateMap; versions: VersionItem[] }, date: string | null) =>
        date ? (group.byDate[date] || []) : group.versions;

    const firstKeyForDate = (group: { byDate: DateMap }, date: string | null) =>
        date && group.byDate[date]?.[0]?.key ? group.byDate[date][0].key : null;

    const formatTime = (ts?: number) => {
        if (!ts) return '';
        return new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(ts);
    };

    const getAudioBaseKey = (key: string) => key.replace(/-part\d+(?=\.mp3$)/i, '');
    const getAudioPartNumber = (key: string) => {
        const m = key.match(/-part(\d+)(?=\.mp3$)/i);
        return m ? Number(m[1]) : 1;
    };
    const groupAudioVersions = (versions: VersionItem[]): AudioGroup[] => {
        const map = new Map<string, VersionItem[]>();
        versions.forEach((v) => {
            const base = getAudioBaseKey(v.key);
            const arr = map.get(base) || [];
            arr.push(v);
            map.set(base, arr);
        });
        return Array.from(map.entries()).map(([baseKey, parts]) => ({
            baseKey,
            parts: parts.sort((a, b) => getAudioPartNumber(a.key) - getAudioPartNumber(b.key)),
        }));
    };

    const downloadMergedAudio = async (group: AudioGroup) => {
        try {
            setDownloadLoading(true);
            const buffers: ArrayBuffer[] = [];
            for (const part of group.parts) {
                const res = await fetch('/api/admin/download-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: part.key }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'URL 생성 실패');
                const fileRes = await fetch(json.url);
                if (!fileRes.ok) throw new Error('파일 다운로드 실패');
                buffers.push(await fileRes.arrayBuffer());
            }
            const merged = new Blob(buffers.map((b) => new Uint8Array(b)), { type: 'audio/mpeg' });
            const url = URL.createObjectURL(merged);
            const a = document.createElement('a');
            a.href = url;
            a.download = group.baseKey.split('/').pop() || 'merged-audio.mp3';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err?.message || '병합 다운로드에 실패했습니다.');
        } finally {
            setDownloadLoading(false);
        }
    };

    const renderTimeChips = (versions: VersionItem[], selectedKey: string | null, onSelect: (k: string) => void) => {
        if (versions.length <= 1) return null;
        return (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {versions.map((v) => {
                    const isActive = v.key === selectedKey;
                    return (
                        <button
                            key={v.key}
                            onClick={() => onSelect(v.key)}
                            className="whitespace-nowrap rounded-full border px-3 py-1 text-[13px] transition-colors"
                            style={{
                                borderColor: isActive ? PRIMARY : '#E5E7EB',
                                backgroundColor: isActive ? '#F4F0FF' : '#FFFFFF',
                                color: isActive ? PRIMARY : '#374151',
                            }}
                        >
                            {formatTime(v.lastModified)}
                        </button>
                    );
                })}
            </div>
        );
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

    const pickKeyForDate = (group: { byDate: DateMap }, date: string | null) =>
        firstKeyForDate(group, date);

    const applyDateSelection = (origin: 'vp' | 'sp', date: string | null) => {
        if (!data) return;
        if (origin === 'vp') {
            const source = data.vp;
            setSelectedKeys((prev) => ({
                ...prev,
                vp: {
                    script: pickKeyForDate(source.script, date) || source.script.latestKey,
                    narrative: pickKeyForDate(source.narrative, date) || source.narrative.latestKey,
                    structured: pickKeyForDate(source.structured, date) || source.structured.latestKey,
                    audio: null,
                }
            }));
            setVpDateKey(date);
        } else {
            const source = data.sp;
            setSelectedKeys((prev) => ({
                ...prev,
                sp: {
                    script: pickKeyForDate(source.script, date) || source.script.latestKey,
                    narrative: pickKeyForDate(source.narrative, date) || source.narrative.latestKey,
                    structured: pickKeyForDate(source.structured, date) || source.structured.latestKey,
                    audio: source.audio ? (pickKeyForDate(source.audio, date) || source.audio.latestKey) : null,
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
        const dateSet = new Set<string>([
            ...Object.keys(artifacts.script.byDate || {}),
            ...Object.keys(artifacts.narrative.byDate || {}),
            ...Object.keys(artifacts.structured.byDate || {}),
            ...('audio' in artifacts && artifacts.audio?.byDate ? Object.keys(artifacts.audio.byDate) : []),
        ]);
        const dateList = Array.from(dateSet).sort().reverse();
        const selectedDate = dateKey || dateList[0] || null;
        const scriptVersions = versionsForDate(artifacts.script, selectedDate);
        const narrativeVersions = versionsForDate(artifacts.narrative, selectedDate);
        const structuredVersions = versionsForDate(artifacts.structured, selectedDate);
        const audioVersions = 'audio' in artifacts ? versionsForDate(artifacts.audio!, selectedDate) : [];

        const selectedSet = origin === 'VP' ? selectedKeys.vp : selectedKeys.sp;
        const selectedScriptKey = scriptVersions.find((v) => v.key === selectedSet.script)?.key || scriptVersions[0]?.key || null;
        const selectedNarrKey = narrativeVersions.find((v) => v.key === selectedSet.narrative)?.key || narrativeVersions[0]?.key || null;
        const selectedStructKey = structuredVersions.find((v) => v.key === selectedSet.structured)?.key || structuredVersions[0]?.key || null;
        const selectedAudioKey = 'audio' in artifacts
            ? (audioVersions.find((v) => v.key === selectedSet.audio)?.key || audioVersions[0]?.key || null)
            : null;
        const audioGroups = 'audio' in artifacts ? groupAudioVersions(audioVersions) : [];
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

        const handleTimeSelect = (artifact: 'script' | 'narrative' | 'structured' | 'audio', key: string) => {
            setSelectedKeys((prev) => ({
                ...prev,
                [origin === 'VP' ? 'vp' : 'sp']: {
                    ...prev[origin === 'VP' ? 'vp' : 'sp'],
                    [artifact]: key,
                },
            }));
            if (artifact === 'script' || artifact === 'narrative' || artifact === 'structured') {
                void ensureContent(key);
            }
        };

        return (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
                </div>
                <div className="mb-3">
                    <div className="text-sm font-medium text-gray-700">날짜 선택</div>
                    {renderDateChips(
                        dateList,
                        selectedDate,
                        (d) => onDateChange?.(d)
                    )}
                </div>

                <div className="space-y-4 mt-3">
                    <div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">스크립트</h3>
                        {renderTimeChips(scriptVersions, selectedScriptKey, (k) => handleTimeSelect('script', k))}
                        {renderScriptBlock(
                            selectedScriptKey,
                            scriptText || (selectedScriptKey === artifacts.script.latestKey ? artifacts.script.latestText : null),
                            findTimestamp(artifacts.script.versions, selectedScriptKey)
                        )}
                    </div>


                    {'audio' in artifacts && audioVersions.length > 0 && (
                        <div>
                            <div className='w-full flex gap-4 items-center'>
                                <h3 className="text-base font-semibold text-gray-700 mb-1">오디오</h3>
                            </div>
                            {renderTimeChips(audioVersions, selectedAudioKey, (k) => handleTimeSelect('audio', k))}
                            {showAudioButton && audioGroups.map((group) => (
                                <div key={group.baseKey} className="mt-2 space-y-2 border border-gray-200 rounded-md p-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-gray-800 break-all">
                                            {group.baseKey.split('/').pop()}
                                        </div>
                                        {group.parts.length > 1 && (
                                            <button
                                                onClick={() => downloadMergedAudio(group)}
                                                disabled={downloadLoading}
                                                className="rounded-md px-3 py-1 text-sm font-medium text-white disabled:opacity-60 transition-colors hover:brightness-95"
                                                style={{ backgroundColor: PRIMARY, ...(downloadLoading ? {} : { cursor: 'pointer' }) }}
                                            >
                                                {downloadLoading ? '병합 중...' : '병합 다운로드'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {group.parts.map((p, idx) => (
                                            <button
                                                key={p.key}
                                                onClick={() => handleDownloadKey(p.key)}
                                                disabled={downloadLoading}
                                                className="rounded-md border border-gray-200 px-3 py-1 text-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
                                            >
                                                파트 {idx + 1} 다운로드
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">피드백</h3>
                        <div className="text-[14px] text-gray-500">
                            {findTimestamp(artifacts.narrative.versions, selectedNarrKey)}
                        </div>
                        {renderTimeChips(narrativeVersions, selectedNarrKey, (k) => handleTimeSelect('narrative', k))}
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
                        {renderTimeChips(structuredVersions, selectedStructKey, (k) => handleTimeSelect('structured', k))}
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
            <header className="flex items-center justify-between">
                <div>
                    <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
                        ← Admin Dashboard
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900">
                        {showVerification ? '학생증 관리' : '학생 조회'}
                    </h1>
                </div>
            </header>
            <>
                    {showVerification && (
                        <div className="rounded-xl bg-white px-5 pb-5">
                            <div className="flex items-center justify-between pt-5">
                                <h2 className="text-lg font-semibold text-gray-800">학생증 인증 요청</h2>
                                <button
                                    onClick={loadVerifications}
                                    className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    새로고침
                                </button>
                            </div>

                            {verificationError && (
                                <div className="mt-3 text-sm text-red-600">{verificationError}</div>
                            )}
                            {verificationLoading && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                                    <Spinner size={18} />
                                    불러오는 중...
                                </div>
                            )}

                            {!verificationLoading && verificationList.length === 0 && (
                                <div className="mt-4 text-sm text-gray-500">요청이 없습니다.</div>
                            )}

                            <div className="mt-4 space-y-3">
                                {verificationList.map((item) => {
                                    const statusLabel =
                                        item.status === 'APPROVED'
                                            ? '승인'
                                            : item.status === 'REJECTED'
                                                ? '반려'
                                                : '대기';
                                    const statusColor =
                                        item.status === 'APPROVED'
                                            ? '#16A34A'
                                            : item.status === 'REJECTED'
                                                ? '#DC2626'
                                                : '#D97706';
                                    const isUpdating = updatingVerificationId === item.id;

                                    return (
                                        <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div className="space-y-1 text-sm text-gray-700">
                                                    <div className="text-base font-semibold text-gray-900">
                                                        {item.user?.displayName || '이름 미입력'}
                                                        {item.user?.studentNumber ? ` (${item.user.studentNumber})` : ''}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {item.user?.email || '이메일 없음'}
                                                    </div>
                                                    <div className="text-sm">
                                                        상태:{' '}
                                                        <span style={{ color: statusColor }}>{statusLabel}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        제출일: {formatIso(item.submittedAt)}
                                                    </div>
                                                    {item.reviewedAt && (
                                                        <div className="text-xs text-gray-500">
                                                            처리일: {formatIso(item.reviewedAt)}
                                                        </div>
                                                    )}
                                                    {item.rejectReason && (
                                                        <div className="text-xs text-red-600">
                                                            거절 사유: {item.rejectReason}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => handleDownloadKey(item.s3Key)}
                                                        disabled={downloadLoading}
                                                        className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
                                                    >
                                                        학생증 보기
                                                    </button>
                                                </div>
                                            </div>

                                            {item.status === 'PENDING' && (
                                                <div className="mt-4 flex flex-col gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="거절 사유를 입력하세요"
                                                        value={rejectReasons[item.id] || ''}
                                                        onChange={(e) =>
                                                            setRejectReasons((prev) => ({
                                                                ...prev,
                                                                [item.id]: e.target.value,
                                                            }))
                                                        }
                                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                                                        style={{ ['--primary' as any]: PRIMARY }}
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleVerificationUpdate(item.id, 'APPROVED')}
                                                            disabled={isUpdating}
                                                            className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                                            style={{ backgroundColor: PRIMARY }}
                                                        >
                                                            승인
                                                        </button>
                                                        <button
                                                            onClick={() => handleVerificationUpdate(item.id, 'REJECTED')}
                                                            disabled={isUpdating}
                                                            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                                        >
                                                            반려
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {showStudentLookup && (
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
            </>
        </div>
    );
}
