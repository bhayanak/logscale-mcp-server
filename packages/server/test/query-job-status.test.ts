import { describe, it, expect, vi, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogScaleClient, LogScaleApiError } from "../src/logscale/client.js";
import type { LogScaleConfig, QueryResult } from "../src/logscale/types.js";
import { handleGetQueryJob, registerGetQueryJobTool } from "../src/tools/query-job-status.js";
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

describe("registerGetQueryJobTool", () => {
  it("should register without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerGetQueryJobTool(server, makeClient(), testConfig);
    expect(true).toBe(true);
  });
});

describe("handleGetQueryJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return error when no repository is specified and no default", async () => {
    const configNoRepo: LogScaleConfig = { ...testConfig, defaultRepository: "" };
    const result = await handleGetQueryJob({ jobId: "job-123" }, makeClient(), configNoRepo);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No repository specified");
  });

  it("should return formatted results on success", async () => {
    const client = makeClient();
    vi.spyOn(client, "getQueryResult").mockResolvedValueOnce(doneResult as unknown as QueryResult);

    const result = await handleGetQueryJob({ jobId: "job-123" }, client, testConfig);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Job ID: job-123");
    expect(result.content[0].text).toContain("Repository: test-repo");
    expect(result.structuredContent?.done).toBe(true);
    expect(result.structuredContent?.eventCount).toBe(3);
  });

  it("should use tool-specified repository over config default", async () => {
    const client = makeClient();
    const spy = vi
      .spyOn(client, "getQueryResult")
      .mockResolvedValueOnce(doneResult as unknown as QueryResult);

    await handleGetQueryJob({ jobId: "job-123", repository: "custom-repo" }, client, testConfig);

    expect(spy).toHaveBeenCalledWith("custom-repo", "job-123", expect.anything());
  });

  it("should cap maxEvents at 500", async () => {
    const client = makeClient();
    const spy = vi
      .spyOn(client, "getQueryResult")
      .mockResolvedValueOnce(doneResult as unknown as QueryResult);

    await handleGetQueryJob({ jobId: "job-123", maxEvents: 1000 }, client, testConfig);

    expect(spy).toHaveBeenCalledWith("test-repo", "job-123", { paginationLimit: 500 });
  });

  it("should handle 404 job not found error", async () => {
    const client = makeClient();
    vi.spyOn(client, "getQueryResult").mockRejectedValueOnce(
      new LogScaleApiError("Not Found", 404, ""),
    );

    const result = await handleGetQueryJob({ jobId: "job-123" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
    expect(result.content[0].text).toContain("job-123");
  });

  it("should handle generic LogScaleApiError", async () => {
    const client = makeClient();
    vi.spyOn(client, "getQueryResult").mockRejectedValueOnce(
      new LogScaleApiError("Server error", 500, "internal"),
    );

    const result = await handleGetQueryJob({ jobId: "job-123" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LogScale API error");
  });

  it("should handle generic Error", async () => {
    const client = makeClient();
    vi.spyOn(client, "getQueryResult").mockRejectedValueOnce(new Error("Connection refused"));

    const result = await handleGetQueryJob({ jobId: "job-123" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Connection refused");
  });

  it("should handle non-Error throw", async () => {
    const client = makeClient();
    vi.spyOn(client, "getQueryResult").mockRejectedValueOnce("string error");

    const result = await handleGetQueryJob({ jobId: "job-123" }, client, testConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("string error");
  });
});
