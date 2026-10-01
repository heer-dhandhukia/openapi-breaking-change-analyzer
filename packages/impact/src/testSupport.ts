import path from "node:path";
import type { MatchResult } from "./match.js";

/**
 * Rewrites every absolute file path in a MatchResult to be relative to `rootDir`, so golden
 * JSON fixtures are portable across machines/CI rather than baking in this machine's
 * absolute repo path. Test-only -- not part of the package's public API.
 */
export function toPortableResult(result: MatchResult, rootDir: string): unknown {
  const rel = (p: string) => path.relative(rootDir, p);
  return {
    impacts: result.impacts.map((impact) => ({
      ...impact,
      endpoint: { ...impact.endpoint, file: rel(impact.endpoint.file) },
      sites: impact.sites.map((site) => ({ ...site, file: rel(site.file) })),
      stories: impact.stories.map(rel),
    })),
    unmatched: result.unmatched,
  };
}
