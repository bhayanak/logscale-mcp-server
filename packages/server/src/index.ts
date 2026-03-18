#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();

  // Graceful shutdown handler
  let shutdownInProgress = false;
  const shutdown = async (signal: string) => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    console.error(`[logscale-mcp] Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      console.error("[logscale-mcp] Server closed cleanly");
    } catch (err) {
      console.error("[logscale-mcp] Error during shutdown:", err);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await server.connect(transport);
  console.error("LogScale MCP server started on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting LogScale MCP server:", error);
  process.exit(1);
});
