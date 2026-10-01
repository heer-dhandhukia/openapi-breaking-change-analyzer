import { runChangelog } from "./oasdiffClient.js";
import { normalizeChanges, type NormalizeResult } from "./normalize.js";

export { runChangelog } from "./oasdiffClient.js";
export type { RunChangelogOptions } from "./oasdiffClient.js";
export { normalizeChanges } from "./normalize.js";
export type { NormalizeResult } from "./normalize.js";
export { normalizePathParams } from "./pathParams.js";
export type { RawOasdiffChange, OasdiffSource } from "./oasdiffTypes.js";
export type { ChangeKind, SpecChange } from "./types.js";

export interface DiffSpecsOptions {
  binPath?: string;
}

/** Diffs two OpenAPI specs and returns normalized SpecChange[] plus any unmapped oasdiff changes. */
export async function diffSpecs(basePath: string, revisionPath: string, options: DiffSpecsOptions = {}): Promise<NormalizeResult> {
  const raw = await runChangelog(basePath, revisionPath, options);
  return normalizeChanges(raw);
}
