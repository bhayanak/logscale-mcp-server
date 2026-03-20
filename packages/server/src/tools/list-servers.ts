import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerRegistry } from "../logscale/server-registry.js";

export function registerListServersTool(server: McpServer, registry: ServerRegistry): void {
  server.tool(
    "list_servers",
    "List all configured LogScale server instances. " +
      "Returns server names, base URLs, default repositories, and which is the default. " +
      "Use the server name in the 'server' parameter of search_logs or get_query_job.",
    {},
    async () => {
      const summaries = registry.getServerSummaries();
      const lines = summaries.map((s) => {
        const parts = [`  Name: ${s.name}`];
        parts.push(`  URL: ${s.baseUrl}`);
        if (s.repository) parts.push(`  Repository: ${s.repository}`);
        if (s.isDefault) parts.push(`  (default)`);
        return parts.join("\n");
      });

      const text = `Available LogScale Servers (${summaries.length}):\n\n${lines.join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
