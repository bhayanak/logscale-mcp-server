import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LogScaleClient } from "../logscale/client.js";
import { LogScaleApiError } from "../logscale/client.js";
import type { LogScaleConfig } from "../logscale/types.js";
import { buildQueryJobInput } from "../logscale/query-builder.js";
import { formatQueryResult } from "../formatter.js";
import { MAX_QUERY_STRING_LENGTH, MAX_REPOSITORY_NAME_LENGTH } from "../config.js";

export const searchLogsInputSchema = {
  queryString: z
    .string()
    .describe(
      "CQL query string. Use pipe (|) to chain filters. Examples: " +
        "'kubernetes.namespace_name = \"my-ns\"', " +
        "'ERROR | kubernetes.pod_name = \"my-pod-*\"', " +
        '\'"kubernetes.namespace_name" = "ai" | "kubernetes.labels.app" = "manager"\'',
    ),

  repository: z
    .string()
    .optional()
    .describe("LogScale repository name. Uses default from config if omitted."),

  start: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      "Start of time range. Relative: '1h', '24h', '7d', '30m'. " +
        "Absolute: epoch ms (e.g. 1773599400000). Default: '1h'.",
    ),

  end: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      "End of time range. Relative: 'now'. " +
        "Absolute: epoch ms (e.g. 1773602999999). Default: 'now'.",
    ),

  maxEvents: z
    .number()
    .optional()
    .describe("Maximum number of events to return (default: 200, max: 500)."),

  isLive: z
    .boolean()
    .optional()
    .describe("If true, run as a live/streaming query. Default: false."),
};

interface SearchLogsParams {
  queryString: string;
  repository?: string;
  start?: string | number;
  end?: string | number;
  maxEvents?: number;
  isLive?: boolean;
}

interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export async function handleSearchLogs(
  params: SearchLogsParams,
  client: LogScaleClient,
  config: LogScaleConfig,
): Promise<ToolResult> {
  const { queryString, repository, start, end, maxEvents, isLive } = params;
  const repo = repository ?? config.defaultRepository;
  if (!repo) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: No repository specified and no default repository configured. Provide a 'repository' parameter or set LOGSCALE_REPOSITORY env var.",
        },
      ],
      isError: true,
    };
  }

  // Input size limits
  if (queryString.length > MAX_QUERY_STRING_LENGTH) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: queryString exceeds maximum length (${queryString.length} > ${MAX_QUERY_STRING_LENGTH} chars).`,
        },
      ],
      isError: true,
    };
  }
  if (repo.length > MAX_REPOSITORY_NAME_LENGTH) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: repository name exceeds maximum length (${repo.length} > ${MAX_REPOSITORY_NAME_LENGTH} chars).`,
        },
      ],
      isError: true,
    };
  }

  const limit = Math.min(maxEvents ?? config.maxEvents, 500);

  try {
    const input = buildQueryJobInput({
      queryString,
      start,
      end,
      isLive,
    });

    const result = await client.executeQuery(repo, input, {
      paginationLimit: limit,
    });

    const formatted = formatQueryResult(result, queryString, repo);

    return {
      content: [{ type: "text" as const, text: formatted }],
      structuredContent: {
        done: result.done,
        cancelled: result.cancelled,
        eventCount: result.metaData.eventCount,
        processedEvents: result.metaData.processedEvents,
        processedBytes: result.metaData.processedBytes,
        timeMillis: result.metaData.timeMillis,
        events: result.events,
      },
    };
  } catch (error: unknown) {
    let message: string;
    if (error instanceof LogScaleApiError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        message = `Authentication failed (${error.statusCode}). Check LOGSCALE_API_TOKEN.`;
      } else if (error.statusCode === 404) {
        message = `Repository '${repo}' not found. Check the repository name.`;
      } else {
        message = `LogScale API error: ${error.message}`;
      }
    } else {
      message = error instanceof Error ? error.message : String(error);
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Error querying LogScale: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export function registerSearchLogsTool(
  server: McpServer,
  client: LogScaleClient,
  config: LogScaleConfig,
): void {
  server.tool(
    "search_logs",
    "Search logs in LogScale using CrowdStrike Query Language (CQL). " +
      "Submits a query job, polls for completion, and returns results. " +
      "Use pipe (|) to chain filters in queryString.",
    searchLogsInputSchema,
    async (params) => handleSearchLogs(params, client, config),
  );
}
