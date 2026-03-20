import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, loadMultiServerConfig, MAX_QUERY_STRING_LENGTH, MAX_REPOSITORY_NAME_LENGTH } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.LOGSCALE_BASE_URL = "https://logscale.example.com";
    process.env.LOGSCALE_API_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load config from environment variables", () => {
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://logscale.example.com");
    expect(config.apiToken).toBe("test-token");
    expect(config.timeoutMs).toBe(60000);
    expect(config.pollIntervalMs).toBe(1000);
    expect(config.maxEvents).toBe(200);
  });

  it("should throw if LOGSCALE_BASE_URL is not set", () => {
    delete process.env.LOGSCALE_BASE_URL;
    expect(() => loadConfig()).toThrow("LOGSCALE_BASE_URL environment variable is required");
  });

  it("should throw if LOGSCALE_API_TOKEN is not set", () => {
    delete process.env.LOGSCALE_API_TOKEN;
    expect(() => loadConfig()).toThrow("LOGSCALE_API_TOKEN environment variable is required");
  });

  it("should strip trailing slashes from baseUrl", () => {
    process.env.LOGSCALE_BASE_URL = "https://logscale.example.com///";
    const config = loadConfig();
    expect(config.baseUrl).toBe("https://logscale.example.com");
  });

  it("should read optional config values", () => {
    process.env.LOGSCALE_REPOSITORY = "my-repo";
    process.env.LOGSCALE_TIMEOUT_MS = "30000";
    process.env.LOGSCALE_POLL_INTERVAL_MS = "2000";
    process.env.LOGSCALE_MAX_EVENTS = "500";
    const config = loadConfig();
    expect(config.defaultRepository).toBe("my-repo");
    expect(config.timeoutMs).toBe(30000);
    expect(config.pollIntervalMs).toBe(2000);
    expect(config.maxEvents).toBe(500);
  });

  describe("HTTPS enforcement", () => {
    it("should allow HTTP in non-production mode", () => {
      process.env.LOGSCALE_BASE_URL = "http://logscale.local";
      delete process.env.NODE_ENV;
      const config = loadConfig();
      expect(config.baseUrl).toBe("http://logscale.local");
    });

    it("should allow HTTPS in production mode", () => {
      process.env.NODE_ENV = "production";
      process.env.LOGSCALE_BASE_URL = "https://logscale.example.com";
      const config = loadConfig();
      expect(config.baseUrl).toBe("https://logscale.example.com");
    });

    it("should reject HTTP in production mode", () => {
      process.env.NODE_ENV = "production";
      process.env.LOGSCALE_BASE_URL = "http://logscale.example.com";
      expect(() => loadConfig()).toThrow("LOGSCALE_BASE_URL must use HTTPS in production mode");
    });

    it("should reject HTTP with path in production mode", () => {
      process.env.NODE_ENV = "production";
      process.env.LOGSCALE_BASE_URL = "http://logscale.example.com/logs";
      expect(() => loadConfig()).toThrow("LOGSCALE_BASE_URL must use HTTPS in production mode");
    });
  });
});

describe("input size limit constants", () => {
  it("should have correct MAX_QUERY_STRING_LENGTH", () => {
    expect(MAX_QUERY_STRING_LENGTH).toBe(10_000);
  });

  it("should have correct MAX_REPOSITORY_NAME_LENGTH", () => {
    expect(MAX_REPOSITORY_NAME_LENGTH).toBe(256);
  });
});

describe("loadMultiServerConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LOGSCALE_BASE_URL;
    delete process.env.LOGSCALE_API_TOKEN;
    delete process.env.LOGSCALE_SERVERS;
    delete process.env.LOGSCALE_REPOSITORY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load from LOGSCALE_SERVERS JSON", () => {
    process.env.LOGSCALE_SERVERS = JSON.stringify([
      { name: "scdev01", baseUrl: "https://scdev01.example.com/logs", apiToken: "token1", repository: "repo1" },
      { name: "hcipoc01", baseUrl: "https://hcipoc01.example.com/logs", apiToken: "token2" },
    ]);
    const config = loadMultiServerConfig();
    expect(config.servers.size).toBe(2);
    expect(config.defaultServerName).toBe("scdev01");
    expect(config.servers.get("scdev01")?.apiToken).toBe("token1");
    expect(config.servers.get("hcipoc01")?.repository).toBeUndefined();
  });

  it("should fall back to single-server env vars as 'default'", () => {
    process.env.LOGSCALE_BASE_URL = "https://logscale.example.com";
    process.env.LOGSCALE_API_TOKEN = "test-token";
    process.env.LOGSCALE_REPOSITORY = "my-repo";
    const config = loadMultiServerConfig();
    expect(config.servers.size).toBe(1);
    expect(config.defaultServerName).toBe("default");
    expect(config.servers.get("default")?.baseUrl).toBe("https://logscale.example.com");
    expect(config.servers.get("default")?.repository).toBe("my-repo");
  });

  it("should combine LOGSCALE_SERVERS and single-server env vars", () => {
    process.env.LOGSCALE_SERVERS = JSON.stringify([
      { name: "scdev01", baseUrl: "https://scdev01.example.com", apiToken: "token1" },
    ]);
    process.env.LOGSCALE_BASE_URL = "https://logscale.example.com";
    process.env.LOGSCALE_API_TOKEN = "test-token";
    const config = loadMultiServerConfig();
    expect(config.servers.size).toBe(2);
    // Single-server vars take precedence as default
    expect(config.defaultServerName).toBe("default");
    expect(config.servers.has("scdev01")).toBe(true);
    expect(config.servers.has("default")).toBe(true);
  });

  it("should throw when no servers configured at all", () => {
    expect(() => loadMultiServerConfig()).toThrow("No LogScale servers configured");
  });

  it("should throw when LOGSCALE_SERVERS is empty array", () => {
    process.env.LOGSCALE_SERVERS = "[]";
    expect(() => loadMultiServerConfig()).toThrow("must be a non-empty JSON array");
  });

  it("should throw when LOGSCALE_SERVERS entry missing required fields", () => {
    process.env.LOGSCALE_SERVERS = JSON.stringify([{ name: "test" }]);
    expect(() => loadMultiServerConfig()).toThrow("must have name, baseUrl, and apiToken");
  });

  it("should strip trailing slashes from server baseUrls", () => {
    process.env.LOGSCALE_SERVERS = JSON.stringify([
      { name: "test", baseUrl: "https://example.com///", apiToken: "t" },
    ]);
    const config = loadMultiServerConfig();
    expect(config.servers.get("test")?.baseUrl).toBe("https://example.com");
  });
});
