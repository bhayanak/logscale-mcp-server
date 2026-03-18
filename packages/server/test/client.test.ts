import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LogScaleClient, LogScaleApiError } from "../src/logscale/client.js";
import type { LogScaleConfig } from "../src/logscale/types.js";
import submitResponse from "./fixtures/submit-query-response.json";
import doneResult from "./fixtures/query-result-done.json";
import pendingResult from "./fixtures/query-result-pending.json";

const testConfig: LogScaleConfig = {
  baseUrl: "https://logscale.example.com",
  apiToken: "test-token-abc",
  defaultRepository: "test-repo",
  timeoutMs: 5000,
  pollIntervalMs: 100,
  maxEvents: 200,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html" },
  });
}

describe("LogScaleClient", () => {
  let client: LogScaleClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new LogScaleClient(testConfig);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submitQuery", () => {
    it("should POST to the correct URL with auth header", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(submitResponse));

      const result = await client.submitQuery("my-repo", {
        queryString: "ERROR",
      });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://logscale.example.com/api/v1/repositories/my-repo/queryjobs");
      expect((options as RequestInit).method).toBe("POST");
      expect((options as RequestInit).headers).toEqual({
        Authorization: "Bearer test-token-abc",
        "Content-Type": "application/json",
        Accept: "application/json",
      });
      expect(result.id).toBe("test-job-123");
    });

    it("should URL-encode the repository name", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(submitResponse));

      await client.submitQuery("repo/with spaces", {
        queryString: "test",
      });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("repo%2Fwith%20spaces");
    });

    it("should send the query body as JSON", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(submitResponse));

      const input = {
        queryString: '"kubernetes.namespace_name" = "ai" | ERROR',
        start: "1h",
        end: "now",
        isLive: false,
      };
      await client.submitQuery("my-repo", input);

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.queryString).toBe(input.queryString);
      expect(body.start).toBe("1h");
      expect(body.end).toBe("now");
      expect(body.isLive).toBe(false);
    });

    it("should throw LogScaleApiError on HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
          headers: { "Content-Type": "text/plain" },
        }),
      );

      await expect(client.submitQuery("my-repo", { queryString: "test" })).rejects.toThrow(
        LogScaleApiError,
      );
    });

    it("should throw on HTML response (wrong base URL)", async () => {
      fetchSpy.mockResolvedValueOnce(
        htmlResponse("<!-- Copyright --><!DOCTYPE html><html>...</html>"),
      );

      await expect(client.submitQuery("my-repo", { queryString: "test" })).rejects.toThrow(
        /LOGSCALE_BASE_URL/,
      );
    });
  });

  describe("getQueryResult", () => {
    it("should GET with pagination params", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(doneResult));

      const result = await client.getQueryResult("my-repo", "job-123", {
        paginationLimit: 100,
        paginationOffset: 50,
      });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("paginationLimit=100");
      expect(url).toContain("paginationOffset=50");
      expect(result.done).toBe(true);
      expect(result.events).toHaveLength(3);
    });

    it("should use default maxEvents when no limit provided", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(doneResult));

      await client.getQueryResult("my-repo", "job-123");

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("paginationLimit=200");
    });

    it("should throw on HTML response", async () => {
      fetchSpy.mockResolvedValueOnce(htmlResponse("<!-- Copyright --><!DOCTYPE html>"));

      await expect(client.getQueryResult("my-repo", "job-123")).rejects.toThrow(
        /LOGSCALE_BASE_URL/,
      );
    });
  });

  describe("executeQuery", () => {
    it("should submit then poll until done", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(submitResponse)) // submit
        .mockResolvedValueOnce(jsonResponse(pendingResult)) // poll 1 (not done)
        .mockResolvedValueOnce(jsonResponse(doneResult)); // poll 2 (done)

      const result = await client.executeQuery("my-repo", {
        queryString: "ERROR",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result.done).toBe(true);
      expect(result.events).toHaveLength(3);
    });

    it("should return partial results on timeout", async () => {
      // Make polling always return "not done" — use implementation to create fresh Response each call
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(submitResponse))
        .mockImplementation(() => Promise.resolve(jsonResponse(pendingResult)));

      const result = await client.executeQuery(
        "my-repo",
        { queryString: "ERROR" },
        { timeoutMs: 300, pollIntervalMs: 50 },
      );

      expect(result.done).toBe(false);
    });

    it("should return on cancelled result", async () => {
      const cancelledResult = {
        ...pendingResult,
        cancelled: true,
      };
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(submitResponse))
        .mockResolvedValueOnce(jsonResponse(cancelledResult));

      const result = await client.executeQuery("my-repo", {
        queryString: "ERROR",
      });

      expect(result.cancelled).toBe(true);
    });

    it("should use server-suggested pollAfter interval", async () => {
      const customPollResult = {
        ...pendingResult,
        metaData: { ...pendingResult.metaData, pollAfter: 200 },
      };
      fetchSpy
        .mockResolvedValueOnce(jsonResponse(submitResponse))
        .mockResolvedValueOnce(jsonResponse(customPollResult))
        .mockResolvedValueOnce(jsonResponse(doneResult));

      const start = Date.now();
      await client.executeQuery("my-repo", { queryString: "ERROR" }, { pollIntervalMs: 50 });
      const elapsed = Date.now() - start;

      // Should have waited at least 200ms (server-suggested) instead of 50ms
      expect(elapsed).toBeGreaterThanOrEqual(180);
    });
  });
});

describe("LogScaleApiError", () => {
  it("should include status code and response body", () => {
    const error = new LogScaleApiError("test error", 401, "Unauthorized body");
    expect(error.message).toBe("test error");
    expect(error.statusCode).toBe(401);
    expect(error.responseBody).toBe("Unauthorized body");
    expect(error.name).toBe("LogScaleApiError");
    expect(error).toBeInstanceOf(Error);
  });
});
