import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  HistoryEvidenceChecklist,
  PhysicalexamEvidenceChecklist,
  EducationEvidenceChecklist,
  PpiEvidenceChecklist,
} from "../src/assets/evidenceChecklist/evidenceChecklist_01_acuteAbdominalPain";

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// example 배열을 문자열로 변환
function convertToDbFormat(items: { id: string; title: string; criteria: string; example: string[] }[]) {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    criteria: item.criteria,
    example: item.example.length > 0 ? item.example.join(" / ") : undefined,
  }));
}

async function main() {
  const chiefComplaint = "급성복통";

  // 기존 버전 확인
  const existing = await prisma.evidenceChecklist.findFirst({
    where: { chiefComplaint },
    orderBy: { version: "desc" },
  });

  const nextVersion = existing ? (parseFloat(existing.version) + 0.1).toFixed(1) : "0.1";

  const checklistJson = {
    HistoryEvidenceChecklist: convertToDbFormat(HistoryEvidenceChecklist),
    PhysicalexamEvidenceChecklist: convertToDbFormat(PhysicalexamEvidenceChecklist),
    EducationEvidenceChecklist: convertToDbFormat(EducationEvidenceChecklist),
    PpiEvidenceChecklist: convertToDbFormat(PpiEvidenceChecklist),
  };

  const result = await prisma.evidenceChecklist.create({
    data: {
      chiefComplaint,
      version: nextVersion,
      checklistJson,
    },
  });

  console.log(`✅ ${chiefComplaint} v${nextVersion} 등록 완료!`);
  console.log(`   - History: ${HistoryEvidenceChecklist.length}개`);
  console.log(`   - Physical: ${PhysicalexamEvidenceChecklist.length}개`);
  console.log(`   - Education: ${EducationEvidenceChecklist.length}개`);
  console.log(`   - PPI: ${PpiEvidenceChecklist.length}개`);
  console.log(`   - ID: ${result.id}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
