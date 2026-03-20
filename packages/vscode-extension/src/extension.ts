import * as vscode from "vscode";
import * as path from "path";

export function activate(context: vscode.ExtensionContext): void {
  const serverPath = path.join(context.extensionPath, "dist", "server.js");
  const config = vscode.workspace.getConfiguration("logscale");

  const outputChannel = vscode.window.createOutputChannel("LogScale MCP");
  outputChannel.appendLine("LogScale MCP extension activated");
  outputChannel.appendLine(`Server entrypoint: ${serverPath}`);
  context.subscriptions.push(outputChannel);

  // Register the MCP server with VS Code so it appears in MCP tools
  const provider: vscode.McpServerDefinitionProvider = {
    provideMcpServerDefinitions(_token: vscode.CancellationToken) {
      const env = buildEnvFromConfig(
        vscode.workspace.getConfiguration("logscale"),
      );
      const server = new vscode.McpStdioServerDefinition(
        "LogScale",
        process.execPath, // Use VS Code's Node.js
        [serverPath],
        env,
        context.extension.packageJSON.version,
      );
      outputChannel.appendLine(
        `Providing MCP server: node ${serverPath}`,
      );
      return [server];
    },
  };

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider("logscale-mcp", provider),
  );

  // Register health check command
  const healthCmd = vscode.commands.registerCommand(
    "logscale-mcp.showHealth",
    async () => {
      const cfg = vscode.workspace.getConfiguration("logscale");
      const info = [
        `Server path: ${serverPath}`,
        `Base URL: ${cfg.get<string>("baseUrl") ?? "(not set)"}`,
        `Repository: ${cfg.get<string>("repository") ?? "(not set)"}`,
        `Timeout: ${cfg.get<number>("timeoutMs", 60000)}ms`,
      ].join("\n");

      await vscode.window.showInformationMessage(info, { modal: true });
    },
  );
  context.subscriptions.push(healthCmd);

  // Watch for config changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("logscale")) {
      vscode.window.showInformationMessage(
        "LogScale MCP configuration changed. Restart the MCP server for changes to take effect.",
      );
    }
  });
  context.subscriptions.push(configWatcher);
}

export function deactivate(): void {
  // No cleanup needed — VS Code manages the MCP server lifecycle
}

function buildEnvFromConfig(
  config: vscode.WorkspaceConfiguration,
): Record<string, string> {
  const env: Record<string, string> = {};

  // Multi-server: serialize logscale.servers array to LOGSCALE_SERVERS JSON
  const servers = config.get<Array<{ name: string; baseUrl: string; apiToken: string; repository?: string }>>("servers");
  if (servers && servers.length > 0) {
    env.LOGSCALE_SERVERS = JSON.stringify(servers);
  }

  // Single-server settings (backward compat — becomes "default" server)
  const apiToken = config.get<string>("apiToken");
  if (apiToken) env.LOGSCALE_API_TOKEN = apiToken;

  const baseUrl = config.get<string>("baseUrl");
  if (baseUrl) env.LOGSCALE_BASE_URL = baseUrl;

  const repository = config.get<string>("repository");
  if (repository) env.LOGSCALE_REPOSITORY = repository;

  const timeoutMs = config.get<number>("timeoutMs");
  if (timeoutMs) env.LOGSCALE_TIMEOUT_MS = String(timeoutMs);

  const pollIntervalMs = config.get<number>("pollIntervalMs");
  if (pollIntervalMs) env.LOGSCALE_POLL_INTERVAL_MS = String(pollIntervalMs);

  const maxEvents = config.get<number>("maxEvents");
  if (maxEvents) env.LOGSCALE_MAX_EVENTS = String(maxEvents);

  return env;
}
