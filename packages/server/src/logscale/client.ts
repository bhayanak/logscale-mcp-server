import type {
  LogScaleConfig,
  QueryJobInput,
  QueryJobStartedResult,
  QueryResult,
  PollOptions,
  ExecuteOptions,
} from "./types.js";

const MAX_CONCURRENT_QUERIES = 5;

function log(message: string): void {
  process.stderr.write(`[logscale-mcp] ${message}\n`);
}

export class LogScaleClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly defaultTimeoutMs: number;
  private readonly defaultPollIntervalMs: number;
  private readonly defaultMaxEvents: number;
  private activeQueries = 0;

  constructor(private readonly config: LogScaleConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    this.defaultTimeoutMs = config.timeoutMs;
    this.defaultPollIntervalMs = config.pollIntervalMs;
    this.defaultMaxEvents = config.maxEvents;
  }

  getActiveQueryCount(): number {
    return this.activeQueries;
  }

  /**
   * Step 1: Submit a query job.
   * POST /api/v1/repositories/{repository}/queryjobs
   */
  async submitQuery(repository: string, input: QueryJobInput): Promise<QueryJobStartedResult> {
    const url = `${this.baseUrl}/api/v1/repositories/${encodeURIComponent(repository)}/queryjobs`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new LogScaleApiError(
        `Failed to submit query job: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const body = await response.text();
      throw new LogScaleApiError(
        `Unexpected response content-type: ${contentType}. Expected JSON. ` +
          `This usually means the LOGSCALE_BASE_URL is incorrect (check for a path prefix like /logs).`,
        response.status,
        body.slice(0, 500),
      );
    }

    return (await response.json()) as QueryJobStartedResult;
  }

  /**
   * Step 2: Poll for query results (single poll).
   * GET /api/v1/repositories/{repository}/queryjobs/{jobId}
   */
  async getQueryResult(
    repository: string,
    jobId: string,
    options?: PollOptions,
  ): Promise<QueryResult> {
    const params = new URLSearchParams();
    const limit = options?.paginationLimit ?? this.defaultMaxEvents;
    params.set("paginationLimit", String(limit));
    if (options?.paginationOffset !== undefined) {
      params.set("paginationOffset", String(options.paginationOffset));
    }

    const url = `${this.baseUrl}/api/v1/repositories/${encodeURIComponent(repository)}/queryjobs/${encodeURIComponent(jobId)}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new LogScaleApiError(
        `Failed to get query results: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const body = await response.text();
      throw new LogScaleApiError(
        `Unexpected response content-type: ${contentType}. Expected JSON. ` +
          `This usually means the LOGSCALE_BASE_URL is incorrect (check for a path prefix like /logs).`,
        response.status,
        body.slice(0, 500),
      );
    }

    return (await response.json()) as QueryResult;
  }

  /**
   * Combined: submit a query job and poll until done (or timeout).
   */
  async executeQuery(
    repository: string,
    input: QueryJobInput,
    options?: ExecuteOptions,
  ): Promise<QueryResult> {
    if (this.activeQueries >= MAX_CONCURRENT_QUERIES) {
      throw new Error(
        `Too many concurrent queries (${this.activeQueries}/${MAX_CONCURRENT_QUERIES}). Wait for existing queries to complete.`,
      );
    }

    this.activeQueries++;
    log(`Submitting query to ${repository}: ${input.queryString.slice(0, 100)}`);

    try {
      const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
      const pollIntervalMs = options?.pollIntervalMs ?? this.defaultPollIntervalMs;

      const job = await this.submitQuery(repository, input);
      log(`Query job started: ${job.id}`);
      const startTime = Date.now();

      while (true) {
        const result = await this.getQueryResult(repository, job.id, {
          paginationLimit: options?.paginationLimit,
          paginationOffset: options?.paginationOffset,
        });

        if (result.done || result.cancelled) {
          log(
            `Query job ${job.id} finished: ${result.metaData.eventCount} events in ${result.metaData.timeMillis}ms`,
          );
          return result;
        }

        if (Date.now() - startTime > timeoutMs) {
          log(`Query job ${job.id} timed out after ${timeoutMs}ms, returning partial results`);
          return result;
        }

        // Use server-suggested poll interval if available, otherwise default
        const waitMs = result.metaData?.pollAfter ?? pollIntervalMs;
        await sleep(waitMs);
      }
    } finally {
      this.activeQueries--;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LogScaleApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "LogScaleApiError";
  }
}
