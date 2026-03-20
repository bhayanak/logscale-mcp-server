// TypeScript types derived from query-api.yaml (LogScale Query API OpenAPI spec)

// --- Request Types ---

export interface QueryJobInput {
  queryString: string;
  start?: string | number;
  end?: string | number;
  isLive?: boolean;
  languageVersion?: string;
  timeZone?: string;
  timeZoneOffsetMinutes?: number;
  arguments?: Record<string, string>;
  showQueryEventDistribution?: boolean;
  computeFieldStats?: boolean;
  allowEventSkipping?: boolean;
  noResultUntilDone?: boolean;
  isInteractive?: boolean;
  includeDeletedEvents?: boolean;
  autobucketCount?: number;
  wantsAutoBucketing?: boolean;
  useIngestTime?: boolean;
  isAlertQuery?: boolean;
  doneCriteria?: DoneCriteria;
}

export interface DoneCriteria {
  fractionOfDataScanned?: number;
  minimumMatchedEvents?: number;
  minimumResultRows?: number;
}

// --- Response Types ---

export interface QueryJobStartedResult {
  id: string;
  queryOnView?: string;
  hashedQueryOnView?: string;
  staticMetaData?: {
    executionMode?: ExecutionMode;
  };
}

export interface ExecutionMode {
  runMode: string;
  details?: string;
}

export interface QueryResult {
  done: boolean;
  cancelled: boolean;
  events: LogEvent[];
  metaData: QueryMetaData;
  warnings?: WarningJson[];
  fieldStats?: FieldStat[];
  queryEventDistribution?: QueryEventDistribution;
  filterMatches?: EventFieldMatches[];
  filesUsed?: FileInfo[];
}

export interface LogEvent {
  "@timestamp": number;
  "@id"?: string;
  "@rawstring"?: string;
  "@ingesttimestamp"?: string;
  "@timezone"?: string;
  "@timestamp.nanos"?: string;
  log?: string;
  "kubernetes.namespace_name"?: string;
  "kubernetes.pod_name"?: string;
  "kubernetes.container_name"?: string;
  [field: string]: unknown;
}

export interface WarningJson {
  classification?: string;
  code: string;
  message: string;
  category: string;
}

export interface QueryEventDistribution {
  events: EventDistributionBucket[];
  extraData: {
    bucket_first_bucket?: string;
    bucket_last_bucket?: string;
    bucket_span_humanized?: string;
    bucket_span_millis?: string;
  };
}

export interface EventDistributionBucket {
  _count: string;
  _bucket: string;
}

export interface QueryMetaData {
  eventCount: number;
  isAggregate: boolean;
  processedBytes: number;
  processedEvents: number;
  timeMillis: number;
  queryStart: number;
  queryEnd: number;
  pollAfter?: number;
  totalWork: number;
  workDone: number;
  resultBufferSize: number;
  queuedMillis?: number;
  fieldOrder?: string[];
  responderVHost?: number;
  warning?: string;
  warnings?: string[];
  extraData?: QueryExtraData;
  filterQuery?: QueryJobInput;
  namedFilterQueries?: NamedEventTab[];
  costs: QueryCostMetadata;
  querySpent: QueryQuotaMeta;
  quotaTotalSpent: QueryQuotaMeta;
  digestFlow?: DigestFlowMeta;
}

export interface QueryExtraData {
  sortOrder?: SortOrderItem[];
  timeSettingsOverwrittenFromQuery?: {
    start?: string;
    end?: string;
    timezoneName?: string;
  };
  [key: string]: unknown;
}

export interface SortOrderItem {
  field: string;
  type: string;
  order: string;
}

export interface NamedEventTab {
  name: string;
  query: QueryJobInput;
}

export interface QueryCostMetadata {
  liveCost: number;
  staticCost: number;
  liveCostRate: number;
  staticCostRate: number;
}

export interface DigestFlowMeta {
  minIngestTimeIncluded: number;
  ingestTimeKnownGood: number;
  maxIngestLatency: number;
}

export interface QueryQuotaMeta {
  oneMinute: QueryQuotaSpent;
  tenMinutes: QueryQuotaSpent;
  hour: QueryQuotaSpent;
  day: QueryQuotaSpent;
}

export interface QueryQuotaSpent {
  queryCount: number;
  staticCost: number;
  liveCost: number;
}

export interface FieldStat {
  fieldName?: string;
  numOfOccurrences?: number;
  numOfDistinctValues?: number;
  topValues?: Record<string, number>;
}

export interface FileInfo {
  name: string;
  contentHash: string;
  modifiedTimestamp: number;
  queryToRead?: string;
  tableType: "File" | "Table" | "RemoteTable" | "Unknown";
}

export type EventFieldMatches = Record<string, FilterMatch[]>;

export interface FilterMatch {
  filterId: number;
  ranges: FilterMatchRange[];
}

export interface FilterMatchRange {
  start: number;
  length: number;
}

// --- Client Configuration ---

export interface LogScaleConfig {
  baseUrl: string;
  apiToken: string;
  defaultRepository?: string;
  timeoutMs: number;
  pollIntervalMs: number;
  maxEvents: number;
}

export interface LogScaleServerEntry {
  name: string;
  baseUrl: string;
  apiToken: string;
  repository?: string;
}

export interface MultiServerConfig {
  servers: Map<string, LogScaleServerEntry>;
  defaultServerName: string;
  timeoutMs: number;
  pollIntervalMs: number;
  maxEvents: number;
}

export interface PollOptions {
  paginationLimit?: number;
  paginationOffset?: number;
}

export interface ExecuteOptions extends PollOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}
