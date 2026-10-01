// Re-exported here so `@blast/impact` remains the one-stop import for all shared types per
// SPEC.md's "Core types (packages/impact/src/types.ts)" -- the actual definitions live
// with their producers (spec-diff produces SpecChange, fe-index produces UsageSite) to
// avoid a circular workspace dependency, since impact itself depends on both for matching.
// See DECISIONS.md.
export type { ChangeKind, SpecChange } from "@blast/spec-diff";
export type { UsageSite } from "@blast/fe-index";

import type { SpecChange } from "@blast/spec-diff";
import type { UsageSite } from "@blast/fe-index";

export interface Impact {
  change: SpecChange;
  confidence: "exact" | "possible"; // exact = field provably read; possible = spread/passed/any-typed
  endpoint: { name: string; file: string; line: number };
  sites: UsageSite[];
  stories: string[]; // story files that render affected components
}
