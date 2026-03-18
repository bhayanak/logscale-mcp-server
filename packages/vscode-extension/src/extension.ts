import * as vscode from "vscode";
import * as path from "path";
import { ChildProcess, spawn } from "child_process";

let serverProcess: ChildProcess | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // The bundled MCP server entry point
  const serverPath = path.join(context.extensionPath, "dist", "server.js");

  // Read configuration
  const config = vscode.workspace.getConfiguration("logscale");

  // Register the MCP server configuration so VS Code can discover it
  const mcpConfig = {
    command: "node",
    args: [serverPath],
    env: buildEnvFromConfig(config),
  };

  // Store the server path for the health command
  context.globalState.update("serverPath", serverPath);

  // Register health check command
  const healthCmd = vscode.commands.registerCommand("logscale-mcp.showHealth", async () => {
    const info = [
      `Server path: ${serverPath}`,
      `Base URL: ${config.get<string>("baseUrl") ?? "(not set)"}`,
      `Repository: ${config.get<string>("repository") ?? "(not set)"}`,
      `Timeout: ${config.get<number>("timeoutMs", 60000)}ms`,
      `Status: ${serverProcess ? "Running" : "Not started"}`,
    ].join("\n");

    await vscode.window.showInformationMessage(info, { modal: true });
  });

  context.subscriptions.push(healthCmd);

  // Watch for config changes and notify user to restart
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("logscale")) {
      vscode.window.showInformationMessage(
        "LogScale MCP configuration changed. Restart the MCP server for changes to take effect.",
      );
    }
  });
  context.subscriptions.push(configWatcher);

  // Log that extension activated
  const outputChannel = vscode.window.createOutputChannel("LogScale MCP");
  outputChannel.appendLine(`LogScale MCP extension activated`);
  outputChannel.appendLine(`Server entrypoint: ${serverPath}`);
  outputChannel.appendLine(`MCP server config: ${JSON.stringify(mcpConfig, null, 2)}`);
  context.subscriptions.push(outputChannel);
}

export function deactivate(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = undefined;
  }
}

function buildEnvFromConfig(
  config: vscode.WorkspaceConfiguration,
): Record<string, string> {
  const env: Record<string, string> = {};

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
