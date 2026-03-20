import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LogScaleClient } from "../logscale/client.js";
import { LogScaleApiError } from "../logscale/client.js";
import type { LogScaleConfig } from "../logscale/types.js";
import type { ServerRegistry } from "../logscale/server-registry.js";
import { formatJobStatus } from "../formatter.js";

export const queryJobInputSchema = {
  jobId: z.string().describe("Query job ID returned from a previous search_logs call."),

  server: z
    .string()
    .optional()
    .describe(
      "Name of the LogScale server where the query job was submitted. " +
        "Must match the server used in the original search_logs call. Uses default if omitted.",
    ),

  repository: z
    .string()
    .optional()
    .describe("LogScale repository name. Uses default from config if omitted."),

  maxEvents: z
    .number()
    .optional()
    .describe("Maximum number of events to return (default: 200, max: 500)."),
};

interface QueryJobParams {
  jobId: string;
  server?: string;
  repository?: string;
  maxEvents?: number;
}

interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export async function handleGetQueryJob(
  params: QueryJobParams,
  client: LogScaleClient,
  config: LogScaleConfig,
): Promise<ToolResult> {
  const { jobId, repository, maxEvents } = params;
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

  const limit = Math.min(maxEvents ?? config.maxEvents, 500);

  try {
    const result = await client.getQueryResult(repo, jobId, {
      paginationLimit: limit,
    });

    const formatted = formatJobStatus(result, jobId, repo);

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
      if (error.statusCode === 404) {
        message = `Query job '${jobId}' not found. It may have expired or the repository is incorrect.`;
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
          text: `Error polling query job: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export function registerGetQueryJobTool(server: McpServer, registry: ServerRegistry): void {
  server.tool(
    "get_query_job",
    "Check the status and retrieve results of an existing LogScale query job. " +
      "Useful for long-running queries or resuming a previous search. " +
      "Use the 'server' parameter to specify which LogScale instance the job is on.",
    queryJobInputSchema,
    async (params) => {
      try {
        const { client, config: srvConfig } = registry.getClient(params.server);
        return handleGetQueryJob(params, client, srvConfig);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
