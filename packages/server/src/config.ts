import type { LogScaleConfig, MultiServerConfig, LogScaleServerEntry } from "./logscale/types.js";

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

export function loadMultiServerConfig(): MultiServerConfig {
  const timeoutMs = parseInt(process.env.LOGSCALE_TIMEOUT_MS ?? "60000", 10);
  const pollIntervalMs = parseInt(process.env.LOGSCALE_POLL_INTERVAL_MS ?? "1000", 10);
  const maxEvents = parseInt(process.env.LOGSCALE_MAX_EVENTS ?? "200", 10);

  const servers = new Map<string, LogScaleServerEntry>();
  let defaultServerName = "";

  // Parse LOGSCALE_SERVERS JSON if present
  const serversJson = process.env.LOGSCALE_SERVERS;
  if (serversJson) {
    const parsed = JSON.parse(serversJson) as LogScaleServerEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("LOGSCALE_SERVERS must be a non-empty JSON array");
    }
    for (const entry of parsed) {
      if (!entry.name || !entry.baseUrl || !entry.apiToken) {
        throw new Error(
          `Each entry in LOGSCALE_SERVERS must have name, baseUrl, and apiToken. Got: ${JSON.stringify(entry)}`,
        );
      }
      const normalized: LogScaleServerEntry = {
        ...entry,
        baseUrl: entry.baseUrl.replace(/\/+$/, ""),
      };
      servers.set(normalized.name, normalized);
    }
    defaultServerName = parsed[0].name;
  }

  // Add single-server env vars as "default" entry (backward compat)
  const baseUrl = process.env.LOGSCALE_BASE_URL;
  const apiToken = process.env.LOGSCALE_API_TOKEN;
  if (baseUrl && apiToken) {
    const name = "default";
    if (!servers.has(name)) {
      servers.set(name, {
        name,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        apiToken,
        repository: process.env.LOGSCALE_REPOSITORY,
      });
    }
    // Single-server env vars take precedence as the default
    defaultServerName = name;
  }

  if (servers.size === 0) {
    throw new Error(
      "No LogScale servers configured. Set LOGSCALE_SERVERS JSON or LOGSCALE_BASE_URL + LOGSCALE_API_TOKEN.",
    );
  }

  return {
    servers,
    defaultServerName,
    timeoutMs,
    pollIntervalMs,
    maxEvents,
  };
}
