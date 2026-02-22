// src/lib/pipeline/retryWithBackoff.ts
// 429 rate-limit 등 일시적 에러에 대한 exponential backoff retry

import { logger } from "@/lib/logger";

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  retryableStatusCodes?: number[];
  label?: string;
}

/**
 * fn을 실행하되, 429 등 retryable 에러 시 exponential backoff로 재시도.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 2000,
    retryableStatusCodes = [429, 500, 502, 503],
    label = "retryWithBackoff",
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status ?? err?.code;
      const isRetryable = retryableStatusCodes.includes(Number(status));
      const isLast = attempt === maxRetries;

      if (!isRetryable || isLast) {
        throw err;
      }

      // Retry-After 헤더가 있으면 그 값 사용, 없으면 exponential backoff
      const retryAfter = err?.headers?.["retry-after"];
      const delayMs = retryAfter
        ? Number(retryAfter) * 1000
        : baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;

      logger.warn(`${label}: ${status} error, retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${maxRetries})`, {
        source: "pipeline/retry",
      });

      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // unreachable
  throw new Error(`${label}: max retries exceeded`);
}
