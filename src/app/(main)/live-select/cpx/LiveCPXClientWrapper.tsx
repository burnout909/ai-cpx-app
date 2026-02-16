'use client';

import { useEffect, useState } from "react";
import LiveCPXClient from "./LiveCPXClient";
import { VirtualPatient } from "@/utils/loadVirtualPatient";

interface Props {
    category: string;
    caseName: string;
    scenarioId: string;
}

export default function LiveCPXClientWrapper({ category, caseName, scenarioId }: Props) {
    const [patientImageUrl, setPatientImageUrl] = useState<string | undefined>(undefined);
    const [virtualPatient, setVirtualPatient] = useState<VirtualPatient | null>(null);
    const [customRolePrompt, setCustomRolePrompt] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchScenarioData() {
            if (!scenarioId) {
                setLoading(false);
                return;
            }

            try {
                // Fetch scenario content
                const scenarioRes = await fetch(`/api/admin/scenario?id=${scenarioId}`);
                const scenarioData = await scenarioRes.json();

                if (scenarioRes.ok && scenarioData.scenario?.scenarioContent) {
                    setVirtualPatient(scenarioData.scenario.scenarioContent);
                    if (scenarioData.scenario.rolePromptSnapshot) {
                        setCustomRolePrompt(scenarioData.scenario.rolePromptSnapshot);
                    }
                }

                // Fetch patient image
                const imgRes = await fetch(`/api/admin/patient-image?scenarioId=${scenarioId}`);
                const imgData = await imgRes.json();

                if (imgRes.ok && imgData.patientImage?.url) {
                    setPatientImageUrl(imgData.patientImage.url);
                }
            } catch (err) {
                console.error("시나리오 데이터 로드 실패:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchScenarioData();
    }, [scenarioId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-3 border-[#D0C7FA] border-t-[#7553FC] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <LiveCPXClient
            category={category}
            caseName={caseName}
            scenarioId={scenarioId}
            virtualPatient={virtualPatient || undefined}
            patientImageUrl={patientImageUrl}
            customRolePrompt={customRolePrompt}
        />
    );
}
