import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, MAX_QUERY_STRING_LENGTH, MAX_REPOSITORY_NAME_LENGTH } from "../src/config.js";

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
