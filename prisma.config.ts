import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: ".env.local" });

const directUrl = process.env.DIRECT_URL?.trim();
const datasourceUrl = directUrl || process.env.DATABASE_URL?.trim();
const shadowUrl = process.env.SHADOW_DATABASE_URL?.trim();

if (!datasourceUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set for Prisma.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: datasourceUrl,
    shadowDatabaseUrl:
      shadowUrl && shadowUrl !== datasourceUrl ? shadowUrl : undefined,
  },
});
