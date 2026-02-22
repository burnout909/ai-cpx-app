import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogOptions {
  source?: string;
  userId?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const DB_MIN_LEVEL: LogLevel = "WARN";

function log(level: LogLevel, message: string, options?: LogOptions) {
  const isProduction = process.env.NODE_ENV === "production";

  // Console output: always (dev + production)
  const prefix = `[${level}]`;
  const src = options?.source ? ` (${options.source})` : "";
  switch (level) {
    case "DEBUG":
      console.debug(`${prefix}${src}`, message);
      break;
    case "INFO":
      console.info(`${prefix}${src}`, message);
      break;
    case "WARN":
      console.warn(`${prefix}${src}`, message);
      break;
    case "ERROR":
      console.error(`${prefix}${src}`, message);
      break;
  }

  // DB: production only, WARN and ERROR
  if (isProduction && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[DB_MIN_LEVEL]) {
    prisma.errorLog
      .create({
        data: {
          level,
          message,
          stackTrace: options?.stackTrace,
          source: options?.source,
          userId: options?.userId,
          userAgent: options?.userAgent,
          metadata: (options?.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      })
      .catch((err) => {
        console.error("[logger] Failed to persist log:", err);
      });
  }
}

export const logger = {
  debug: (message: string, options?: LogOptions) => log("DEBUG", message, options),
  info: (message: string, options?: LogOptions) => log("INFO", message, options),
  warn: (message: string, options?: LogOptions) => log("WARN", message, options),
  error: (message: string, options?: LogOptions) => log("ERROR", message, options),
};
