import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogScaleClient } from "./logscale/client.js";
import type { LogScaleConfig } from "./logscale/types.js";
import { registerSearchLogsTool } from "./tools/search-logs.js";
import { registerGetQueryJobTool } from "./tools/query-job-status.js";

const startedAt = Date.now();

export function createServer(config: LogScaleConfig): McpServer {
  const server = new McpServer({
    name: "logscale-mcp-server",
    version: "0.1.0",
  });

  const client = new LogScaleClient(config);

  // Register all tools
  registerSearchLogsTool(server, client, config);
  registerGetQueryJobTool(server, client, config);

  // Health check resource — read via MCP resources/read
  server.resource(
    "server-health",
    "server://health",
    { description: "Server health status" },
    () => {
      const uptimeMs = Date.now() - startedAt;
      const uptimeSec = Math.floor(uptimeMs / 1000);
      const health = {
        status: "healthy",
        uptime: `${uptimeSec}s`,
        uptimeMs,
        version: "0.1.0",
        logscale: {
          baseUrl: config.baseUrl.replace(/\/api.*/, "/..."),
          defaultRepository: config.defaultRepository ?? "(none)",
          timeoutMs: config.timeoutMs,
        },
        activeQueries: client.getActiveQueryCount(),
        timestamp: new Date().toISOString(),
      };

      return {
        contents: [
          {
            uri: "server://health",
            mimeType: "application/json",
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    },
  );

  return server;
}
