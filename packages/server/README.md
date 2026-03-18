<p align="center">
  <strong>LogScale MCP Server</strong><br/>
  <em>Query CrowdStrike LogScale logs from AI assistants via the Model Context Protocol</em>
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%E2%89%A5%2018-brightgreen.svg" alt="Node.js ≥ 18"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript&logoColor=white" alt="TypeScript 5.8"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-1.12-purple.svg" alt="MCP SDK 1.12"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/coverage-97%25-brightgreen.svg" alt="Coverage 97%">
  <img src="https://img.shields.io/badge/tests-67%20passed-brightgreen.svg" alt="67 Tests Passed">
  <img src="https://img.shields.io/badge/build-passing-brightgreen.svg" alt="Build Passing">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/ESLint-security%20rules-4B32C3.svg?logo=eslint&logoColor=white" alt="ESLint Security">
  <img src="https://img.shields.io/badge/Prettier-formatted-F7B93E.svg?logo=prettier&logoColor=white" alt="Prettier">
  <img src="https://img.shields.io/badge/CodeQL-analyzed-2980B9.svg" alt="CodeQL">
  <img src="https://img.shields.io/badge/Trivy-SBOM%20scanned-1904DA.svg" alt="Trivy SBOM">
  <img src="https://img.shields.io/badge/Gitleaks-no%20secrets-critical.svg" alt="Gitleaks">
  <img src="https://img.shields.io/badge/pnpm%20audit-0%20vulnerabilities-brightgreen.svg" alt="pnpm Audit Clean">
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#tools">Tools</a> &bull;
  <a href="#usage">Usage</a> &bull;
  <a href="#cql-query-examples">Queries</a> &bull;
  <a href="#security">Security</a> &bull;
  <a href="#ci-pipeline">CI</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## Introduction

LogScale MCP Server lets you **query CrowdStrike LogScale logs through natural language** in VS Code Copilot Chat, Claude Desktop, or any MCP-compatible client. Instead of writing raw CQL queries and managing API calls, just ask:

> "Show me errors in the xxxx namespace from the last hour"

> "Find all 500 errors from the xyxyxy pod today"

> "Search logs for request ID f6796646b043d231bf67f589b7306e9b"

The server handles query submission, polling, result formatting, and pagination automatically.

## Features

- **2 MCP tools** — `search_logs` and `get_query_job` for comprehensive log querying
- **CrowdStrike Query Language (CQL)** — full support for filters, pipes, aggregations, and field searches
- **Automatic poll loop** — submits query jobs and polls with server-suggested intervals until completion
- **Smart result formatting** — structured output with field statistics, event counts, and metadata
- **Configurable defaults** — custom timeouts, pagination limits, poll intervals, and max events
- **Time range support** — relative (`1h`, `7d`) and absolute (epoch milliseconds) time ranges
- **VS Code Extension** — bundled extension with built-in configuration UI for LogScale connection settings
- **Monorepo architecture** — clean separation between server (`logscale-mcp-server`) and extension (`logscale-mcp-vscode`)

### Quality & Security

| Area | Details |
|------|---------|
| **Test Coverage** | 97% statements · 91% branches · 95% functions — 67 tests across 6 suites |
| **Type Safety** | Strict TypeScript with `noEmit` type checking on every CI run |
| **Linting** | ESLint with `eslint-plugin-security` for vulnerability pattern detection |
| **Formatting** | Prettier-enforced code style across all source and test files |
| **Static Analysis** | GitHub CodeQL with `security-extended` query suite |
| **Dependency Audit** | `pnpm audit` at moderate+ severity — zero known vulnerabilities |
| **SBOM & CVE Scan** | Trivy filesystem scan for CRITICAL and HIGH severity vulnerabilities |
| **Secret Scanning** | Gitleaks in CI + pre-commit hook for local secret detection |
| **Dependency Review** | PR-level review blocking moderate+ severity and GPL-3.0/AGPL-3.0 licenses |
| **Commit Standards** | Conventional Commits enforced via commitlint |
| **Multi-Node Testing** | CI tests on Node.js 18, 20, and 22 |

## Quick Start

### Prerequisites

- **Node.js ≥ 18**
- **pnpm** (recommended) or npm
- A LogScale instance with API access and a Bearer token

### Install from npm

```bash
# Install globally
npm install -g logscale-mcp-server

# Or run directly with npx
npx logscale-mcp-server
```

### Install from Source

```bash
# ...existing code...
```
