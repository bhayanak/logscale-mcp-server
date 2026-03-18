import type { QueryJobInput } from "./types.js";

export interface SearchParams {
  queryString: string;
  start?: string | number;
  end?: string | number;
  isLive?: boolean;
  timeZone?: string;
}

/**
 * Builds a QueryJobInput payload from user-facing search parameters.
 * Applies sensible defaults for optional fields.
 */
export function buildQueryJobInput(params: SearchParams): QueryJobInput {
  const input: QueryJobInput = {
    queryString: params.queryString,
    isLive: params.isLive ?? false,
    showQueryEventDistribution: true,
    computeFieldStats: true,
    allowEventSkipping: false,
    languageVersion: "legacy",
    useIngestTime: false,
    arguments: {},
  };

  // Start time: default to "1h" if not specified
  input.start = params.start ?? "1h";

  // End time: default to "now" if not specified
  input.end = params.end ?? "now";

  if (params.timeZone) {
    input.timeZone = params.timeZone;
  }

  return input;
}
