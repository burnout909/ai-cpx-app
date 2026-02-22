'use client';

import { useEffect, useState } from "react";
import LiveCPXClient from "./LiveCPXClient";
import { VirtualPatient } from "@/utils/loadVirtualPatient";
import { usePageTracking } from "@/hooks/usePageTracking";
import { reportClientError } from "@/lib/reportClientError";

interface Props {
    category: string;
    caseName: string;
    scenarioId: string;
}

export default function LiveCPXClientWrapper({ category, caseName, scenarioId }: Props) {
    usePageTracking("live_cpx");
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
                // Fetch scenario content + patient image in one call
                const scenarioRes = await fetch(`/api/scenario?id=${scenarioId}`);
                const scenarioData = await scenarioRes.json();

                if (scenarioRes.ok && scenarioData.scenario?.scenarioContent) {
                    setVirtualPatient(scenarioData.scenario.scenarioContent);
                    if (scenarioData.scenario.rolePromptSnapshot) {
                        setCustomRolePrompt(scenarioData.scenario.rolePromptSnapshot);
                    }
                }

                if (scenarioRes.ok && scenarioData.patientImageUrl) {
                    setPatientImageUrl(scenarioData.patientImageUrl);
                }
            } catch (err) {
                reportClientError(err instanceof Error ? err.message : String(err), { source: "LiveCPXClientWrapper/fetchScenarioData", stackTrace: err instanceof Error ? err.stack : undefined });
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
