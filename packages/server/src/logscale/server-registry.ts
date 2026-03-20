import { LogScaleClient } from "./client.js";
import type { LogScaleConfig, MultiServerConfig, LogScaleServerEntry } from "./types.js";

/**
 * Manages named LogScaleClient instances, one per configured server.
 */
export class ServerRegistry {
  private readonly clients = new Map<string, LogScaleClient>();
  private readonly entries: Map<string, LogScaleServerEntry>;
  readonly defaultServerName: string;
  private readonly config: MultiServerConfig;

  constructor(config: MultiServerConfig) {
    this.config = config;
    this.entries = config.servers;
    this.defaultServerName = config.defaultServerName;

    // Pre-create clients for all configured servers
    for (const [name, entry] of this.entries) {
      const clientConfig: LogScaleConfig = {
        baseUrl: entry.baseUrl,
        apiToken: entry.apiToken,
        defaultRepository: entry.repository,
        timeoutMs: config.timeoutMs,
        pollIntervalMs: config.pollIntervalMs,
        maxEvents: config.maxEvents,
      };
      this.clients.set(name, new LogScaleClient(clientConfig));
    }
  }

  /**
   * Get a client by server name. Falls back to default if name is undefined.
   * Throws if the server name is not found.
   */
  getClient(serverName?: string): { client: LogScaleClient; config: LogScaleConfig; serverName: string } {
    const name = serverName ?? this.defaultServerName;
    const client = this.clients.get(name);
    const entry = this.entries.get(name);
    if (!client || !entry) {
      const available = this.getServerNames().join(", ");
      throw new Error(
        `Unknown LogScale server '${name}'. Available servers: ${available}`,
      );
    }
    return {
      client,
      config: {
        baseUrl: entry.baseUrl,
        apiToken: entry.apiToken,
        defaultRepository: entry.repository,
        timeoutMs: this.config.timeoutMs,
        pollIntervalMs: this.config.pollIntervalMs,
        maxEvents: this.config.maxEvents,
      },
      serverName: name,
    };
  }

  getServerNames(): string[] {
    return Array.from(this.entries.keys());
  }

  getServerSummaries(): Array<{ name: string; baseUrl: string; repository?: string; isDefault: boolean }> {
    return Array.from(this.entries.entries()).map(([name, entry]) => ({
      name,
      baseUrl: entry.baseUrl,
      repository: entry.repository,
      isDefault: name === this.defaultServerName,
    }));
  }

  getTotalActiveQueries(): number {
    let total = 0;
    for (const client of this.clients.values()) {
      total += client.getActiveQueryCount();
    }
    return total;
  }
}
