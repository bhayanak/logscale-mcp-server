import { describe, it, expect, vi, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogScaleClient, LogScaleApiError } from "../src/logscale/client.js";
import type { LogScaleConfig, QueryResult } from "../src/logscale/types.js";
import { handleSearchLogs, registerSearchLogsTool } from "../src/tools/search-logs.js";
import { MAX_QUERY_STRING_LENGTH, MAX_REPOSITORY_NAME_LENGTH } from "../src/config.js";
import doneResult from "./fixtures/query-result-done.json";

const testConfig: LogScaleConfig = {
  baseUrl: "https://logscale.example.com",
  apiToken: "test-token",
  defaultRepository: "test-repo",
  timeoutMs: 5000,
  pollIntervalMs: 100,
  maxEvents: 200,
};

function makeClient(): LogScaleClient {
  return new LogScaleClient(testConfig);
}

describe("registerSearchLogsTool", () => {
  it("should register without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerSearchLogsTool(server, makeClient(), testConfig);
    expect(true).toBe(true);
  });
});

describe("handleSearchLogs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return error when no repository is specified and no default", async () => {
    const configNoRepo: LogScaleConfig = { ...testConfig, defaultRepository: "" };
    const result = await handleSearchLogs({ queryString: "ERROR" }, makeClient(), configNoRepo);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No repository specified");
  });

  it("should return error when queryString exceeds max length", async () => {
    const longQuery = "A".repeat(MAX_QUERY_STRING_LENGTH + 1);
    const result = await handleSearchLogs({ queryString: longQuery }, makeClient(), testConfig);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("exceeds maximum length");
  });

  it("should return error when repository name exceeds max length", async () => {
    const longRepo = "R".repeat(MAX_REPOSITORY_NAME_LENGTH + 1);
    const result = await handleSearchLogs(
      { queryString: "ERROR", repository: longRepo },
      makeClient(),
      testConfig,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("repository name exceeds maximum length");
  });

  it("should return formatted results on success", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockResolvedValueOnce(doneResult as unknown as QueryResult);

    const result = await handleSearchLogs(
      { queryString: "ERROR", start: "1h", end: "now" },
      client,
      testConfig,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Query: ERROR");
    expect(result.content[0].text).toContain("Repository: test-repo");
    expect(result.structuredContent?.done).toBe(true);
    expect(result.structuredContent?.eventCount).toBe(3);
  });

  it("should use tool-specified repository over config default", async () => {
    const client = makeClient();
    const spy = vi
      .spyOn(client, "executeQuery")
      .mockResolvedValueOnce(doneResult as unknown as QueryResult);

    await handleSearchLogs({ queryString: "ERROR", repository: "custom-repo" }, client, testConfig);

    expect(spy).toHaveBeenCalledWith("custom-repo", expect.anything(), expect.anything());
  });

  it("should cap maxEvents at 500", async () => {
    const client = makeClient();
    const spy = vi
      .spyOn(client, "executeQuery")
      .mockResolvedValueOnce(doneResult as unknown as QueryResult);

    await handleSearchLogs({ queryString: "ERROR", maxEvents: 1000 }, client, testConfig);

    expect(spy).toHaveBeenCalledWith("test-repo", expect.anything(), { paginationLimit: 500 });
  });

  it("should handle 401 auth error", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockRejectedValueOnce(
      new LogScaleApiError("Unauthorized", 401, ""),
    );

    const result = await handleSearchLogs({ queryString: "ERROR" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Authentication failed (401)");
  });

  it("should handle 403 auth error", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockRejectedValueOnce(
      new LogScaleApiError("Forbidden", 403, ""),
    );

    const result = await handleSearchLogs({ queryString: "ERROR" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Authentication failed (403)");
  });

  it("should handle 404 repo not found error", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockRejectedValueOnce(
      new LogScaleApiError("Not Found", 404, ""),
    );

    const result = await handleSearchLogs({ queryString: "ERROR" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("should handle generic LogScaleApiError", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockRejectedValueOnce(
      new LogScaleApiError("Server error", 500, "internal"),
    );

    const result = await handleSearchLogs({ queryString: "ERROR" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LogScale API error");
  });

  it("should handle generic Error", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockRejectedValueOnce(new Error("Network timeout"));

    const result = await handleSearchLogs({ queryString: "ERROR" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network timeout");
  });

  it("should handle non-Error throw", async () => {
    const client = makeClient();
    vi.spyOn(client, "executeQuery").mockRejectedValueOnce("string error");

    const result = await handleSearchLogs({ queryString: "ERROR" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("string error");
  });
});
