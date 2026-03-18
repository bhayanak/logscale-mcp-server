import type { LogScaleConfig } from "./logscale/types.js";

export const MAX_QUERY_STRING_LENGTH = 10_000;
export const MAX_REPOSITORY_NAME_LENGTH = 256;

export function loadConfig(): LogScaleConfig {
  const baseUrl = process.env.LOGSCALE_BASE_URL;
  if (!baseUrl) {
    throw new Error("LOGSCALE_BASE_URL environment variable is required");
  }

  const apiToken = process.env.LOGSCALE_API_TOKEN;
  if (!apiToken) {
    throw new Error("LOGSCALE_API_TOKEN environment variable is required");
  }

  // HTTPS enforcement in production mode
  const isProduction = process.env.NODE_ENV === "production";
  const normalizedUrl = baseUrl.replace(/\/+$/, "");
  if (isProduction && !normalizedUrl.startsWith("https://")) {
    throw new Error(
      "LOGSCALE_BASE_URL must use HTTPS in production mode (NODE_ENV=production). " +
        `Got: ${normalizedUrl.slice(0, 50)}`,
    );
  }

  return {
    baseUrl: normalizedUrl,
    apiToken,
    defaultRepository: process.env.LOGSCALE_REPOSITORY,
    timeoutMs: parseInt(process.env.LOGSCALE_TIMEOUT_MS ?? "60000", 10),
    pollIntervalMs: parseInt(process.env.LOGSCALE_POLL_INTERVAL_MS ?? "1000", 10),
    maxEvents: parseInt(process.env.LOGSCALE_MAX_EVENTS ?? "200", 10),
  };
}
