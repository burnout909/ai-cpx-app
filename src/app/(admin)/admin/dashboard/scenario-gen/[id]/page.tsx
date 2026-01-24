"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ScenarioDetailTabs from "@/component/admin/ScenarioDetailTabs";
import ChiefComplaintDropdown from "@/component/admin/ChiefComplaintDropdown";
import LiveCPXClient from "@/component/dashboard/LiveCPXClient";
import { VirtualPatient } from "@/types/dashboard";
import { ChiefComplaint } from "@/constants/chiefComplaints";

interface ChecklistSnapshot {
  history: { id: string; title: string; criteria: string }[];
  physicalExam: { id: string; title: string; criteria: string }[];
  education: { id: string; title: string; criteria: string }[];
  ppi: { id: string; title: string; criteria: string }[];
}

interface ChecklistIncludedMap {
  [itemId: string]: boolean;
}

interface ScenarioData {
  id: string;
  chiefComplaint: string;
  caseName: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "LEGACY";
  previousScenarioId: string | null;
  scenarioContent: VirtualPatient | null;
  checklistSourceVersionId: string | null;
  checklistItemsSnapshot: ChecklistSnapshot | null;
  checklistIncludedMap: ChecklistIncludedMap | null;
  checklistConfirmedAt: string | null;
  commentaryContent: { html: string } | null;
  createdAt: string;
  publishedAt: string | null;
}

// 초기 시나리오 콘텐츠 (VirtualPatient JSON 전체 구조)
const createInitialScenarioContent = (): VirtualPatient => ({
  id: "",
  title: "",
  description: "",
  type: "object",
  required: ["meta", "history", "additional_history", "physical_exam", "questions"],
  properties: {
    meta: {
      chief_complaint: "",
      diagnosis: "",
      name: "",
      mrn: 0,
      age: 0,
      sex: "",
      vitals: {
        bp: "",
        hr: 0,
        rr: 0,
        bt: 0,
      },
      attitude: "",
      hybrid_skill: "",
    },
  },
  history: {},
  additional_history: {},
  physical_exam: {},
  final_question: "",
});

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isNew = id === "new";

  // 새 시나리오 생성 시 주호소 쿼리 파라미터
  const initialChiefComplaint = searchParams.get("chiefComplaint") as ChiefComplaint | null;

  // 로딩/에러 상태
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // 시나리오 데이터
  const [scenario, setScenario] = useState<ScenarioData | null>(null);

  // 편집용 상태
  const [chiefComplaint, setChiefComplaint] = useState<ChiefComplaint | null>(
    initialChiefComplaint
  );
  const [caseName, setCaseName] = useState("");
  const [scenarioContent, setScenarioContent] = useState<VirtualPatient>(
    createInitialScenarioContent()
  );
  const [checklistSnapshot, setChecklistSnapshot] = useState<ChecklistSnapshot | null>(null);
  const [checklistIncludedMap, setChecklistIncludedMap] = useState<ChecklistIncludedMap>({});
  const [checklistSourceVersionId, setChecklistSourceVersionId] = useState<string | null>(null);
  const [checklistConfirmedAt, setChecklistConfirmedAt] = useState<string | null>(null);
  const [commentaryContent, setCommentaryContent] = useState("");

  // Live CPX 노치 상태
  const [liveLocked, setLiveLocked] = useState(false);

  // 환자 이미지 상태
  const [patientImageUrl, setPatientImageUrl] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  // 배포 확인 모달 상태
  const [showPublishModal, setShowPublishModal] = useState(false);

  // 버전 히스토리
  const [versionHistory, setVersionHistory] = useState<
    { id: string; versionNumber: number; status: string; createdAt: string }[]
  >([]);

  // 데이터 로드
  const fetchScenario = useCallback(async () => {
    if (isNew) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/scenario?id=${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "조회 실패");
      }

      const s = data.scenario as ScenarioData;
      setScenario(s);
      setChiefComplaint(s.chiefComplaint as ChiefComplaint);
      setCaseName(s.caseName);
      setScenarioContent(s.scenarioContent || createInitialScenarioContent());

      // 체크리스트 스냅샷 키 변환 (DB 형식 → UI 형식)
      if (s.checklistItemsSnapshot) {
        const rawSnapshot = s.checklistItemsSnapshot as unknown as Record<string, unknown>;
        const transformedSnapshot: ChecklistSnapshot = {
          history: (rawSnapshot.HistoryEvidenceChecklist || rawSnapshot.history || []) as ChecklistSnapshot["history"],
          physicalExam: (rawSnapshot.PhysicalexamEvidenceChecklist || rawSnapshot.physicalExam || []) as ChecklistSnapshot["physicalExam"],
          education: (rawSnapshot.EducationEvidenceChecklist || rawSnapshot.education || []) as ChecklistSnapshot["education"],
          ppi: (rawSnapshot.PpiEvidenceChecklist || rawSnapshot.ppi || []) as ChecklistSnapshot["ppi"],
        };
        setChecklistSnapshot(transformedSnapshot);
      } else {
        setChecklistSnapshot(null);
      }

      setChecklistIncludedMap(s.checklistIncludedMap || {});
      setChecklistSourceVersionId(s.checklistSourceVersionId);
      setChecklistConfirmedAt(s.checklistConfirmedAt);
      setCommentaryContent(s.commentaryContent?.html || "");
      setVersionHistory(data.versionHistory || []);

      // 환자 이미지 로드
      if (id) {
        try {
          const imgRes = await fetch(`/api/admin/patient-image?scenarioId=${id}`);
          const imgData = await imgRes.json();
          if (imgRes.ok && imgData.patientImage) {
            setPatientImageUrl(imgData.patientImage.url);
            setActiveImageId(imgData.patientImage.id);
          }
        } catch (imgErr) {
          console.warn("환자 이미지 로드 실패:", imgErr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchScenario();
  }, [fetchScenario]);

  // 체크리스트 로드를 위한 이전 주호소 추적
  const [prevChiefComplaint, setPrevChiefComplaint] = useState<string | null>(null);

  // 주호소 변경 시 체크리스트 로드
  useEffect(() => {
    if (!chiefComplaint) return;

    // 기존 시나리오 편집 시에는 이미 스냅샷이 있으므로 로드하지 않음 (최초 로드 시)
    if (!isNew && checklistSnapshot && !prevChiefComplaint) {
      setPrevChiefComplaint(chiefComplaint);
      return;
    }

    // 주호소가 변경되지 않았으면 스킵
    if (prevChiefComplaint === chiefComplaint) return;

    const loadChecklist = async () => {
      try {
        const res = await fetch(`/api/admin/checklist?chiefComplaint=${encodeURIComponent(chiefComplaint)}`);
        const data = await res.json();

        if (!res.ok || !data.latestVersion) {
          console.warn(`${chiefComplaint}에 대한 체크리스트가 없습니다.`);
          setChecklistSnapshot(null);
          setChecklistIncludedMap({});
          setChecklistSourceVersionId(null);
          setPrevChiefComplaint(chiefComplaint);
          return;
        }

        // DB 체크리스트 JSON (키 이름이 다름)
        const rawJson = data.latestVersion.checklistJson as {
          HistoryEvidenceChecklist?: { id: string; title: string; criteria: string }[];
          PhysicalexamEvidenceChecklist?: { id: string; title: string; criteria: string }[];
          EducationEvidenceChecklist?: { id: string; title: string; criteria: string }[];
          PpiEvidenceChecklist?: { id: string; title: string; criteria: string }[];
          // 또는 이미 변환된 형식
          history?: { id: string; title: string; criteria: string }[];
          physicalExam?: { id: string; title: string; criteria: string }[];
          education?: { id: string; title: string; criteria: string }[];
          ppi?: { id: string; title: string; criteria: string }[];
        };

        // UI에서 사용하는 키로 변환
        const checklistJson: ChecklistSnapshot = {
          history: rawJson.HistoryEvidenceChecklist || rawJson.history || [],
          physicalExam: rawJson.PhysicalexamEvidenceChecklist || rawJson.physicalExam || [],
          education: rawJson.EducationEvidenceChecklist || rawJson.education || [],
          ppi: rawJson.PpiEvidenceChecklist || rawJson.ppi || [],
        };

        // ChecklistSnapshot 설정
        setChecklistSnapshot(checklistJson);
        setChecklistSourceVersionId(data.latestVersion.id);

        // 모든 항목을 기본적으로 포함(true)으로 설정
        const includedMap: ChecklistIncludedMap = {};
        for (const section of Object.values(checklistJson)) {
          for (const item of section) {
            includedMap[item.id] = true;
          }
        }
        setChecklistIncludedMap(includedMap);
        setPrevChiefComplaint(chiefComplaint);
      } catch (err) {
        console.error("체크리스트 로드 실패:", err);
      }
    };

    loadChecklist();
  }, [chiefComplaint, isNew, checklistSnapshot, prevChiefComplaint]);

  // 저장
  const handleSave = async (action: "draft" | "publish") => {
    if (!chiefComplaint || !caseName.trim()) {
      setSaveMessage({ type: "error", text: "주호소와 케이스명을 입력해주세요." });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const body = {
        chiefComplaint,
        caseName: caseName.trim(),
        previousScenarioId: isNew ? null : scenario?.id,
        scenarioContent,
        checklistIncludedMap:
          Object.keys(checklistIncludedMap).length > 0 ? checklistIncludedMap : null,
        commentaryContent: commentaryContent ? { html: commentaryContent } : null,
        action,
      };

      // 기존 DRAFT 수정 vs 새 버전 생성
      const isEditingDraft = !isNew && scenario?.status === "DRAFT";

      const res = await fetch("/api/admin/scenario", {
        method: isEditingDraft ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditingDraft ? { id: scenario.id, ...body } : body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "저장 실패");
      }

      setSaveMessage({
        type: "success",
        text: action === "publish" ? "배포되었습니다!" : "임시저장되었습니다.",
      });

      // 새로 생성된 경우 해당 페이지로 이동
      if (isNew || !isEditingDraft) {
        router.push(`/admin/dashboard/scenario-gen/${data.scenario.id}`);
      } else {
        fetchScenario();
      }
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "저장 중 오류 발생",
      });
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!scenario) return;
    if (scenario.status !== "DRAFT") {
      alert("DRAFT 상태의 시나리오만 삭제할 수 있습니다.");
      return;
    }
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/scenario?id=${scenario.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      router.push("/admin/dashboard/scenario-gen");
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 중 오류 발생");
    }
  };

  // 배포 요건 개별 체크
  const hasScenario = Boolean(
    scenarioContent?.history && Object.keys(scenarioContent.history).length > 0
  );
  const hasChecklist = Object.keys(checklistIncludedMap).length > 0;
  const hasCommentary = commentaryContent.trim().length > 0;
  const hasPatientImage = Boolean(patientImageUrl);

  // 배포 가능 여부 확인
  const canPublish = hasScenario && hasChecklist && hasCommentary && hasPatientImage;

  // 수정 가능 여부 (DRAFT는 직접 수정, PUBLISHED는 새 버전 생성)
  // LEGACY는 수정 불가
  const canEdit = isNew || scenario?.status === "DRAFT" || scenario?.status === "PUBLISHED";

  // 환자 이미지 생성 핸들러
  const handlePatientImageGenerated = (imageUrl: string, imageId: string) => {
    setPatientImageUrl(imageUrl || null);
    setActiveImageId(imageId || null);
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full flex-col gap-8 px-8 py-8">
        <header>
          <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
            ← Admin Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">시나리오 편집</h1>
        </header>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-[600px] bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full flex-col gap-8 px-8 py-8">
        <header>
          <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
            ← Admin Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">시나리오 편집</h1>
        </header>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {error}
        </div>
        <button
          onClick={() => router.push("/admin/dashboard/scenario-gen")}
          className="text-violet-600 hover:underline"
        >
          목록으로 돌아가기
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-8 py-8">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
            ← Admin Dashboard
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => router.push("/admin/dashboard/scenario-gen")}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? "새 시나리오 생성" : "시나리오 편집"}
              </h1>
              {scenario && (
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  <span>v{scenario.versionNumber.toFixed(1)}</span>
                  <span>•</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      scenario.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700"
                        : scenario.status === "DRAFT"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {scenario.status === "PUBLISHED"
                      ? "배포됨"
                      : scenario.status === "DRAFT"
                      ? "임시저장"
                      : "이전버전"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {scenario?.status === "DRAFT" && (
            <button
              onClick={handleDelete}
              disabled={liveLocked}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            onClick={() => handleSave("draft")}
            disabled={saving || !canEdit || liveLocked}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "저장 중..." : "임시저장"}
          </button>
          <button
            onClick={() => setShowPublishModal(true)}
            disabled={saving || !canEdit || liveLocked}
            className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "저장 중..." : "배포"}
          </button>
        </div>
      </header>

      {/* 배포 확인 모달 */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">배포 확인</h3>

            {/* 배포 요건 체크리스트 */}
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600 mb-3">배포하려면 아래 요건을 모두 충족해야 합니다.</p>

              {/* 시나리오 생성 */}
              <div className={`flex items-center gap-3 text-sm ${hasScenario ? "text-gray-400" : "text-gray-700"}`}>
                {hasScenario ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={hasScenario ? "line-through" : ""}>시나리오 생성</span>
              </div>

              {/* 체크리스트 확정 */}
              <div className={`flex items-center gap-3 text-sm ${hasChecklist ? "text-gray-400" : "text-gray-700"}`}>
                {hasChecklist ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={hasChecklist ? "line-through" : ""}>체크리스트 확정</span>
              </div>

              {/* 해설 작성 */}
              <div className={`flex items-center gap-3 text-sm ${hasCommentary ? "text-gray-400" : "text-gray-700"}`}>
                {hasCommentary ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={hasCommentary ? "line-through" : ""}>해설 작성</span>
              </div>

              {/* 환자 이미지 생성 */}
              <div className={`flex items-center gap-3 text-sm ${hasPatientImage ? "text-gray-400" : "text-gray-700"}`}>
                {hasPatientImage ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={hasPatientImage ? "line-through" : ""}>환자 이미지 생성</span>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowPublishModal(false);
                  handleSave("publish");
                }}
                disabled={!canPublish}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  canPublish
                    ? "text-white bg-violet-600 hover:bg-violet-700"
                    : "text-gray-400 bg-gray-200 cursor-not-allowed"
                }`}
              >
                진행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISHED 편집 시 새 버전 생성 안내 */}
      {scenario?.status === "PUBLISHED" && (
        <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200">
          배포된 시나리오입니다. 수정 시 새 버전(v{((scenario.versionNumber || 0) + 0.1).toFixed(1)})이 생성됩니다.
        </div>
      )}

      {/* 저장 메시지 */}
      {saveMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            saveMessage.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* 주호소 선택 (새 시나리오만) */}
      {isNew && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            주호소 선택 *
          </label>
          <div className="w-64">
            <ChiefComplaintDropdown
              value={chiefComplaint}
              onChange={setChiefComplaint}
              placeholder="주호소를 선택하세요"
            />
          </div>
        </div>
      )}

      {/* 기존 시나리오: 주호소 표시 */}
      {!isNew && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-gray-500">주호소:</span>
              <span className="ml-2 font-medium text-gray-900">{chiefComplaint}</span>
            </div>
            {versionHistory.length > 1 && (
              <div className="ml-auto">
                <select
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
                  value={scenario?.id || ""}
                  onChange={(e) => router.push(`/admin/dashboard/scenario-gen/${e.target.value}`)}
                >
                  {versionHistory.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber.toFixed(1)} ({v.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 탭 패널 */}
      <div className="h-[calc(100vh-300px)]">
        <ScenarioDetailTabs
          scenarioContent={scenarioContent}
          onScenarioChange={setScenarioContent}
          checklistSnapshot={checklistSnapshot}
          checklistIncludedMap={checklistIncludedMap}
          onChecklistMapChange={setChecklistIncludedMap}
          checklistSourceVersionId={checklistSourceVersionId || undefined}
          checklistConfirmedAt={checklistConfirmedAt}
          commentaryContent={commentaryContent}
          onCommentaryChange={setCommentaryContent}
          scenarioId={isNew ? undefined : id}
          onPatientImageGenerated={handlePatientImageGenerated}
          disabled={!canEdit || liveLocked}
          caseName={caseName}
          onCaseNameChange={setCaseName}
        />
      </div>

      {/* Live CPX 노치 */}
      <LiveCPXClient
        category={chiefComplaint || ""}
        caseName={caseName}
        virtualPatient={scenarioContent}
        variant="panel"
        onLockChange={setLiveLocked}
        patientImageUrl={patientImageUrl || undefined}
      />
    </main>
  );
}
