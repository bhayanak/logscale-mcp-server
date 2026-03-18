import { describe, it, expect } from "vitest";
import { buildQueryJobInput } from "../src/logscale/query-builder.js";

describe("buildQueryJobInput", () => {
  it("should build a basic query with defaults", () => {
    const result = buildQueryJobInput({ queryString: "ERROR" });

    expect(result.queryString).toBe("ERROR");
    expect(result.start).toBe("1h");
    expect(result.end).toBe("now");
    expect(result.isLive).toBe(false);
    expect(result.languageVersion).toBe("legacy");
    expect(result.computeFieldStats).toBe(true);
    expect(result.showQueryEventDistribution).toBe(true);
    expect(result.allowEventSkipping).toBe(false);
    expect(result.useIngestTime).toBe(false);
    expect(result.arguments).toEqual({});
  });

  it("should use provided start and end times", () => {
    const result = buildQueryJobInput({
      queryString: "test",
      start: "24h",
      end: "now",
    });

    expect(result.start).toBe("24h");
    expect(result.end).toBe("now");
  });

  it("should accept absolute epoch timestamps", () => {
    const result = buildQueryJobInput({
      queryString: "test",
      start: 1773599400000,
      end: 1773602999999,
    });

    expect(result.start).toBe(1773599400000);
    expect(result.end).toBe(1773602999999);
  });

  it("should support isLive parameter", () => {
    const result = buildQueryJobInput({
      queryString: "test",
      isLive: true,
    });

    expect(result.isLive).toBe(true);
  });

  it("should include timeZone when provided", () => {
    const result = buildQueryJobInput({
      queryString: "test",
      timeZone: "Asia/Calcutta",
    });

    expect(result.timeZone).toBe("Asia/Calcutta");
  });

  it("should not include timeZone when not provided", () => {
    const result = buildQueryJobInput({ queryString: "test" });

    expect(result.timeZone).toBeUndefined();
  });

  it("should handle complex CQL queries", () => {
    const query =
      '"kubernetes.namespace_name" = "privatecloud-ai" | "kubernetes.labels.app" = "manager"';
    const result = buildQueryJobInput({ queryString: query });

    expect(result.queryString).toBe(query);
  });
});
