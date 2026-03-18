import { describe, it, expect } from "vitest";
import { formatQueryResult, formatJobStatus } from "../src/formatter.js";
import type { QueryResult } from "../src/logscale/types.js";
import doneResult from "./fixtures/query-result-done.json";
import emptyResult from "./fixtures/query-result-empty.json";
import pendingResult from "./fixtures/query-result-pending.json";

describe("formatQueryResult", () => {
  it("should include query, repo, and summary info", () => {
    const output = formatQueryResult(
      doneResult as unknown as QueryResult,
      '"ns" = "ai" | ERROR',
      "storagecentral",
    );

    expect(output).toContain('Query: "ns" = "ai" | ERROR');
    expect(output).toContain("Repository: storagecentral");
    expect(output).toContain("Events Found: 3");
    expect(output).toContain("496ms");
    expect(output).toContain("Completed");
  });

  it("should show Cancelled status when cancelled is true", () => {
    const cancelled: QueryResult = {
      ...(doneResult as unknown as QueryResult),
      done: false,
      cancelled: true,
    };
    const output = formatQueryResult(cancelled, "test", "repo");
    expect(output).toContain("Status: Cancelled");
  });

  it("should show In Progress with percentage when not done and not cancelled", () => {
    const inProgress: QueryResult = {
      ...(pendingResult as unknown as QueryResult),
      done: false,
      cancelled: false,
    };
    const output = formatQueryResult(inProgress, "test", "repo");
    expect(output).toContain("In Progress");
    expect(output).toMatch(/In Progress \(\d+%\)/);
  });

  it("should handle events without a timestamp", () => {
    const noTs: QueryResult = {
      ...(doneResult as unknown as QueryResult),
      events: [{ log: "no timestamp here" }],
      metaData: {
        ...(doneResult as unknown as QueryResult).metaData,
        eventCount: 1,
      },
    };
    const output = formatQueryResult(noTs, "test", "repo");
    expect(output).toContain("unknown");
  });

  it("should format individual events with timestamps and key fields", () => {
    const output = formatQueryResult(doneResult as unknown as QueryResult, "ERROR", "repo");

    expect(output).toContain("[1]");
    expect(output).toContain("[2]");
    expect(output).toContain("[3]");
    expect(output).toContain("response_code=500");
    expect(output).toContain("k8s.pod_name=platform-manager");
    expect(output).toContain("log:");
  });

  it("should display field statistics", () => {
    const output = formatQueryResult(doneResult as unknown as QueryResult, "ERROR", "repo");

    expect(output).toContain("Field Statistics");
    expect(output).toContain("response_code:");
    expect(output).toContain("500 (2)");
    expect(output).toContain("200 (1)");
    expect(output).toContain("method:");
  });

  it("should handle empty results", () => {
    const output = formatQueryResult(emptyResult as unknown as QueryResult, "MISSING", "repo");

    expect(output).toContain("Events Found: 0");
    expect(output).toContain("No Events Found");
  });

  it("should show warnings", () => {
    const output = formatQueryResult(emptyResult as unknown as QueryResult, "test", "repo");

    expect(output).toContain("Warnings");
    expect(output).toContain("matched no events");
  });

  it("should truncate very long log lines", () => {
    const longLog = "A".repeat(1000);
    const result: QueryResult = {
      ...(doneResult as unknown as QueryResult),
      events: [
        {
          "@timestamp": 1773753430690,
          log: longLog,
        },
      ],
    };

    const output = formatQueryResult(result, "test", "repo");
    // The log line should be truncated (500 chars max per MAX_LOG_LINE_LENGTH)
    expect(output.length).toBeLessThan(longLog.length + 500);
    expect(output).toContain("...");
  });

  it("should respect total output size limit", () => {
    // Create a result with many events
    const manyEvents = Array.from({ length: 500 }, (_, i) => ({
      "@timestamp": 1773753430690 - i * 1000,
      log: `Error log line number ${i} with some extra padding text to inflate size`.repeat(5),
      "kubernetes.pod_name": `pod-${i}`,
      response_code: "500",
    }));

    const result: QueryResult = {
      ...(doneResult as unknown as QueryResult),
      events: manyEvents,
      metaData: {
        ...(doneResult as unknown as QueryResult).metaData,
        eventCount: 500,
      },
    };

    const output = formatQueryResult(result, "test", "repo");
    // Should be capped near 20K chars
    expect(output.length).toBeLessThanOrEqual(20100);
    expect(output).toContain("truncated");
  });
});

describe("formatJobStatus", () => {
  it("should format a completed job", () => {
    const output = formatJobStatus(doneResult as unknown as QueryResult, "job-123", "my-repo");

    expect(output).toContain("Job ID: job-123");
    expect(output).toContain("Repository: my-repo");
    expect(output).toContain("Status: Done");
    expect(output).toContain("Progress: 100%");
    expect(output).toContain("Events so far: 3");
  });

  it("should format a pending job with progress", () => {
    const output = formatJobStatus(pendingResult as unknown as QueryResult, "job-456", "my-repo");

    expect(output).toContain("Status: Running");
    expect(output).toContain("Progress: 35%");
    expect(output).toContain("Events so far: 0");
  });

  it("should include events when job is done", () => {
    const output = formatJobStatus(doneResult as unknown as QueryResult, "job-123", "my-repo");

    // formatJobStatus includes events when done
    expect(output).toContain("[1]");
  });

  it("should show warnings if present", () => {
    const withWarnings = {
      ...(doneResult as unknown as QueryResult),
      warnings: [{ code: "W1", message: "test warning", category: "query" }],
    };
    const output = formatJobStatus(withWarnings, "job-123", "repo");

    expect(output).toContain("Warnings");
    expect(output).toContain("test warning");
  });
});
