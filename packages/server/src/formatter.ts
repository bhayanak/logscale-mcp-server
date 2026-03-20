import type { QueryResult, LogEvent, FieldStat } from "./logscale/types.js";

const MAX_OUTPUT_CHARS = 20_000;
const MAX_LOG_LINE_LENGTH = 500;

/**
 * Key fields to display prominently for each event.
 * Order matters — first fields found are shown first.
 */
const KEY_FIELDS = [
  "response_code",
  "method",
  "path",
  "kubernetes.pod_name",
  "kubernetes.namespace_name",
  "kubernetes.container_name",
  "duration",
  "upstream_cluster",
] as const;

/**
 * Format a QueryResult into a human-readable text summary for the AI.
 */
export function formatQueryResult(
  result: QueryResult,
  query: string,
  repository: string,
  serverName?: string,
): string {
  const parts: string[] = [];

  // --- Summary Header ---
  parts.push(formatSummary(result, query, repository, serverName));

  // --- Warnings ---
  if (result.warnings && result.warnings.length > 0) {
    parts.push(formatWarnings(result.warnings));
  }

  // --- Events ---
  if (result.events.length > 0) {
    parts.push(formatEvents(result.events));
  } else {
    parts.push("\n--- No Events Found ---");
  }

  // --- Field Statistics ---
  if (result.fieldStats && result.fieldStats.length > 0) {
    parts.push(formatFieldStats(result.fieldStats));
  }

  let output = parts.join("\n");

  // Final truncation safety net
  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(0, MAX_OUTPUT_CHARS) + "\n\n... [Output truncated due to size]";
  }

  return output;
}

function formatSummary(
  result: QueryResult,
  query: string,
  repository: string,
  serverName?: string,
): string {
  const meta = result.metaData;
  const startDate = new Date(meta.queryStart).toISOString();
  const endDate = new Date(meta.queryEnd).toISOString();
  const processedMB = (meta.processedBytes / (1024 * 1024)).toFixed(1);
  const status = result.done
    ? "Completed"
    : result.cancelled
      ? "Cancelled"
      : `In Progress (${Math.round((meta.workDone / meta.totalWork) * 100)}%)`;

  const lines = [`Query: ${query}`];
  if (serverName) lines.push(`Server: ${serverName}`);
  lines.push(
    `Repository: ${repository}`,
    `Status: ${status}`,
    `Time Range: ${startDate} → ${endDate}`,
    `Events Found: ${meta.eventCount} (processed ${meta.processedEvents} events, ${processedMB} MB)`,
    `Query Time: ${meta.timeMillis}ms`,
  );

  return lines.join("\n");
}

function formatWarnings(warnings: { code: string; message: string; category: string }[]): string {
  const lines = warnings.map((w) => `  [${w.category}] ${w.message}`);
  return `\n--- Warnings ---\n${lines.join("\n")}`;
}

function formatEvents(events: LogEvent[]): string {
  const lines: string[] = ["\n--- Events ---"];
  let charBudget = MAX_OUTPUT_CHARS * 0.7; // reserve 70% for events

  for (let i = 0; i < events.length; i++) {
    const eventLine = formatSingleEvent(events[i], i + 1);
    if (charBudget - eventLine.length < 0) {
      lines.push(`\n... and ${events.length - i} more events (truncated)`);
      break;
    }
    charBudget -= eventLine.length;
    lines.push(eventLine);
  }

  return lines.join("\n");
}

function formatSingleEvent(event: LogEvent, index: number): string {
  const timestamp = event["@timestamp"]
    ? new Date(event["@timestamp"] as number).toISOString()
    : "unknown";

  // Extract key fields
  const keyParts: string[] = [];
  for (const field of KEY_FIELDS) {
    const value = event[field];
    if (value !== undefined && value !== null && value !== "") {
      const shortField = field.replace("kubernetes.", "k8s.");
      keyParts.push(`${shortField}=${value}`);
    }
  }

  const keyInfo = keyParts.length > 0 ? ` | ${keyParts.join(" | ")}` : "";

  // Extract log line
  let logLine = "";
  const rawLog = event.log ?? event["@rawstring"];
  if (rawLog && typeof rawLog === "string" && rawLog.length > 0) {
    logLine =
      rawLog.length > MAX_LOG_LINE_LENGTH ? rawLog.slice(0, MAX_LOG_LINE_LENGTH) + "..." : rawLog;
    logLine = `\n    log: ${logLine}`;
  }

  return `[${index}] ${timestamp}${keyInfo}${logLine}`;
}

function formatFieldStats(fieldStats: FieldStat[]): string {
  // Only show interesting fields (with some variation)
  const interesting = fieldStats.filter(
    (fs) =>
      fs.fieldName &&
      fs.numOfDistinctValues !== undefined &&
      fs.numOfDistinctValues > 1 &&
      fs.numOfDistinctValues <= 20 &&
      fs.topValues &&
      !fs.fieldName.startsWith("@") &&
      !fs.fieldName.startsWith("#"),
  );

  if (interesting.length === 0) return "";

  const lines: string[] = ["\n--- Field Statistics ---"];
  // Show top 10 most interesting fields
  const top = interesting.slice(0, 10);
  for (const fs of top) {
    if (!fs.topValues || !fs.fieldName) continue;
    const values = Object.entries(fs.topValues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([val, count]) => `${val} (${count})`)
      .join(", ");
    lines.push(`${fs.fieldName}: ${values}`);
  }

  return lines.join("\n");
}

/**
 * Format a partial/in-progress result for the get_query_job tool.
 */
export function formatJobStatus(result: QueryResult, jobId: string, repository: string): string {
  const meta = result.metaData;
  const progress = meta.totalWork > 0 ? Math.round((meta.workDone / meta.totalWork) * 100) : 0;

  const parts: string[] = [
    `Job ID: ${jobId}`,
    `Repository: ${repository}`,
    `Status: ${result.done ? "Done" : result.cancelled ? "Cancelled" : "Running"}`,
    `Progress: ${progress}%`,
    `Events so far: ${meta.eventCount}`,
    `Processed: ${meta.processedEvents} events (${(meta.processedBytes / (1024 * 1024)).toFixed(1)} MB)`,
    `Time elapsed: ${meta.timeMillis}ms`,
  ];

  if (result.done && result.events.length > 0) {
    parts.push(formatEvents(result.events));
  }

  if (result.warnings && result.warnings.length > 0) {
    parts.push(formatWarnings(result.warnings));
  }

  return parts.join("\n");
}
