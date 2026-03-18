# LogScale MCP Server — VS Code Extension

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=logscale-mcp.logscale-mcp-vscode"><img src="https://img.shields.io/badge/VS%20Code-Marketplace-007ACC.svg?logo=visual-studio-code" alt="VS Code Marketplace"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%E2%89%A5%2018-brightgreen.svg" alt="Node.js ≥ 18"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-1.12-purple.svg" alt="MCP SDK 1.12"></a>
</p>

A VS Code extension that bundles the [LogScale MCP Server](https://www.npmjs.com/package/logscale-mcp-server) and provides a GUI-configured experience for querying CrowdStrike LogScale logs from AI assistants like **GitHub Copilot** and **Claude**.

## What It Does

Once installed, the extension starts an MCP server that lets you query LogScale logs through natural language in Copilot Chat:

> "Show me errors in the production namespace from the last hour"

> "Find all 500 errors from platform-manager today"

> "Search logs for request ID f6796646b043d231bf67f589b7306e9b"

No need to write CQL queries manually — the AI assistant handles query construction, submission, polling, and result formatting.

## Install

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for **"LogScale MCP Server"**
4. Click **Install**

### From VSIX

```bash
code --install-extension logscale-mcp-vscode-0.1.0.vsix
```

## Configuration

Open VS Code Settings (Cmd+, / Ctrl+,) and search for **"LogScale"**:

| Setting | Description | Default |
|---------|-------------|---------|
| `logscale.baseUrl` | LogScale instance URL (include path prefix like `/logs` if needed) | — |
| `logscale.repository` | Default LogScale repository name | — |
| `logscale.timeoutMs` | Maximum query poll timeout in milliseconds | `60000` |
| `logscale.pollIntervalMs` | Interval between poll requests in milliseconds | `1000` |
| `logscale.maxEvents` | Default pagination limit for events | `200` |

> **Note:** The API token is stored securely in VS Code's Secret Storage and prompted on first use.

## MCP Tools

The extension provides **2 MCP tools** to AI assistants:

### `search_logs`

Submit a CQL query, wait for results, and return formatted log events.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `queryString` | string | Yes | CQL query string |
| `start` | string/number | No | Start time — relative (`"1h"`, `"7d"`) or epoch ms |
| `end` | string/number | No | End time — `"now"` or epoch ms |
| `repository` | string | No | Target repository (overrides default) |
| `maxEvents` | number | No | Max events to return (default: 200, max: 500) |

### `get_query_job`

Check status or retrieve results of an existing query job.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | Yes | Query job ID from a previous search |
| `repository` | string | No | Repository the job was submitted to |
| `maxEvents` | number | No | Max events to return |

## Usage

1. Install the extension and configure your LogScale connection in Settings
2. Open **Copilot Chat** (Cmd+Shift+I / Ctrl+Shift+I)
3. Switch to **Agent** mode (required for MCP tool access)
4. Ask questions about your logs in natural language

### Example Prompts

```
Show me the last hour of errors in the production namespace
Find all 500 errors from the api-server pod in the last 24 hours
How many errors occurred in the last 7 days grouped by pod name?
Search logs for correlation ID abc123def456
Show me deployment failures this week
```

## Commands

| Command | Description |
|---------|-------------|
| `LogScale MCP: Show Server Health` | Display MCP server health status |

## CQL Query Examples

```bash
# Namespace filter
"kubernetes.namespace_name" = "your-namespace"

# Errors in a namespace
kubernetes.namespace_name = "your-namespace" | ERROR

# Aggregations
ERROR | groupBy(kubernetes.pod_name, function=count())
ERROR | top(log, limit=10)
ERROR | timechart(span=5m)
```

## Requirements

- **VS Code** ≥ 1.96.0
- **GitHub Copilot** extension (for Copilot Chat MCP integration)
- A CrowdStrike LogScale instance with API access

## License

[MIT](../../LICENSE)
