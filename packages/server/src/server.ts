import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ServerRegistry } from "./logscale/server-registry.js";
import type { MultiServerConfig } from "./logscale/types.js";
import { registerSearchLogsTool } from "./tools/search-logs.js";
import { registerGetQueryJobTool } from "./tools/query-job-status.js";
import { registerListServersTool } from "./tools/list-servers.js";

const startedAt = Date.now();

export function createServer(config: MultiServerConfig): McpServer {
  const server = new McpServer({
    name: "logscale-mcp-server",
    version: "0.1.0",
  });

  const registry = new ServerRegistry(config);

  // Register all tools
  registerSearchLogsTool(server, registry, config);
  registerGetQueryJobTool(server, registry, config);
  registerListServersTool(server, registry);

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
        servers: registry.getServerSummaries(),
        defaultServer: registry.defaultServerName,
        activeQueries: registry.getTotalActiveQueries(),
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
