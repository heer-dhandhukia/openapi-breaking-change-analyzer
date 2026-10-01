// Shape confirmed against `oasdiff schema` (the JSON Schema oasdiff publishes for its own
// `changelog`/`breaking` --format json output), additionalProperties: false.
export interface OasdiffSource {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface RawOasdiffChange {
  id: string;
  text: string;
  comment?: string;
  disclaimers?: string[];
  /** 1 = info, 2 = warn, 3 = error (confirmed against oasdiff's own text-format output). */
  level: number;
  operation?: string;
  operationId?: string;
  path?: string;
  section?: string;
  attributes?: Record<string, unknown>;
  baseSource?: OasdiffSource;
  revisionSource?: OasdiffSource;
  fingerprint?: string;
}
