"use client";

import React, { useState } from "react";
import { createInitialChecklistJson, createInitialScenarioJson } from "@/assets/initData";
import { ScenarioPannel } from "./ScenarioPannel";
import { ChecklistPannel } from "./ChecklistPannel";
import { ExplanationPannel } from "./ExplanationPannel";
import { VirtualPatient, ChecklistJson } from "@/types/dashboard";
import LiveCPXClient from "./LiveCPXClient";

type Props = {
  initialCategory?: string;
  initialCaseName?: string;
};

export const ScenarioDashboardClient: React.FC<Props> = ({
  initialCategory = "",
  initialCaseName = "",
}) => {
  const [caseName, setCaseName] = useState(initialCaseName);
  const [scenarioJson, setScenarioJson] = useState<VirtualPatient>(
    createInitialScenarioJson()
  );
  const [checklistJson, setChecklistJson] = useState<ChecklistJson>(
    createInitialChecklistJson()
  );
  const [liveLocked, setLiveLocked] = useState(false);
  const [queryCategory] = useState(initialCategory);

  const liveCategory = queryCategory;
  const liveCaseName = caseName;

  const handleSolutionChange = (next: string) => {
    setScenarioJson((prev) => ({
      ...prev,
      solution: next,
    }));
  };

  return (
    <div className="relative mb-10">
      <div className="flex gap-4 lg:gap-6">
        <ScenarioPannel
          scenarioJson={scenarioJson}
          onChange={setScenarioJson}
          disabled={liveLocked}
          contextLabel={
            liveCategory && liveCaseName ? `${liveCategory} | ${liveCaseName}` : undefined
          }
          checklistJson={checklistJson}
          caseName={caseName}
          onCaseNameChange={setCaseName}
        />
        <ChecklistPannel
          checklistJson={checklistJson}
          onChange={setChecklistJson}
          disabled={liveLocked}
        />
        <ExplanationPannel
          value={scenarioJson.solution ?? ""}
          onChange={handleSolutionChange}
          disabled={liveLocked}
        />
      </div>
      <LiveCPXClient
        category={liveCategory}
        caseName={liveCaseName}
        virtualPatient={scenarioJson}
        variant="panel"
        onLockChange={setLiveLocked}
      />
    </div>
  );
};
