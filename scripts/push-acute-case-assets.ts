import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import acuteScenario from "../src/assets/virtualPatient/acute_abdominal_pain_001.json";
import {
  EducationEvidenceChecklist,
  HistoryEvidenceChecklist,
  PhysicalexamEvidenceChecklist,
  PpiEvidenceChecklist,
} from "../src/assets/evidenceChecklist/evidenceChecklist_01_acuteAbdominalPain";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const databaseUrl =
  process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (or DIRECT_URL) for Prisma.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CASE_NAME = "급성복통";

const withChecked = (items: Array<Record<string, unknown>>) =>
  items.map((item) => ({ ...item, checked: true }));

const checklistJson = {
  history: withChecked(HistoryEvidenceChecklist),
  physicalExam: withChecked(PhysicalexamEvidenceChecklist),
  education: withChecked(EducationEvidenceChecklist),
  ppi: withChecked(PpiEvidenceChecklist ?? []),
};

const diagnosis =
  typeof acuteScenario?.properties?.meta?.diagnosis === "string"
    ? acuteScenario.properties.meta.diagnosis.trim()
    : "";
const description =
  typeof acuteScenario?.description === "string"
    ? acuteScenario.description.trim()
    : "";

const data: Record<string, unknown> = {
  name: CASE_NAME,
  scenarioJson: acuteScenario,
  checklistJson,
};
if (diagnosis) data.diagnosis = diagnosis;
if (description) data.description = description;

async function main() {
  if (dryRun) {
    console.log("[dry-run] would upsert case:", CASE_NAME);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const existing = await prisma.case.findFirst({ where: { name: CASE_NAME } });
  if (!existing) {
    const created = await prisma.case.create({ data: data as any });
    console.log("created case:", created.id);
    return;
  }

  const updated = await prisma.case.update({
    where: { id: existing.id },
    data: data as any,
  });
  console.log("updated case:", updated.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
