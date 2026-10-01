// Owned here (fe-index produces these), re-exported from @blast/impact's types.ts for
// convenience per SPEC.md's "Core types (packages/impact/src/types.ts)" -- keeping the
// definition where it's produced avoids a circular workspace dependency (impact needs
// fe-index for matching, so fe-index can't depend back on impact for its own types).
export interface UsageSite {
  file: string;
  line: number;
  column: number;
  kind: "endpoint-def" | "hook-call" | "field-access" | "story" | "mutation-arg";
  symbol: string; // e.g. useGetUserQuery, data.user.email
}

export type EndpointKind = "query" | "mutation";
// 'codegen' is set only when the endpoint's generic type arguments follow the real
// @rtk-query/codegen-openapi convention (`<Key>ApiResponse`/`<Key>ApiArg`) -- see
// DECISIONS.md. Otherwise the key name can't be trusted as a real OpenAPI operationId.
export type EndpointSource = "hand-written" | "codegen";

export interface EndpointDef {
  /** The builder.query/mutation object key, e.g. "getUser". */
  name: string;
  kind: EndpointKind;
  method: string;
  path: string;
  operationId?: string;
  source: EndpointSource;
  file: string;
  line: number;
  /** RTK-Query-generated hook names for this endpoint (regular + Lazy variant for queries). */
  hookNames: string[];
}

/**
 * fe-index's own richer usage site: same shape as the shared `UsageSite` (so it's directly
 * usable as `Impact.sites`), plus a `confidence` fe-index computes itself. The base
 * `UsageSite` type doesn't carry confidence (that's `Impact.confidence`, a Phase 2
 * concept) -- fe-index needs to say "possible" as soon as it hits a spread, a custom
 * wrapper hook, or an any-typed value, per Phase 1B's requirement to never skip those.
 */
export interface FeUsageSite extends UsageSite {
  confidence: "exact" | "possible";
}

export interface EndpointNode {
  endpoint: EndpointDef;
  sites: FeUsageSite[];
  /** Story files (`*.stories.tsx`) that import a component touched by this endpoint. */
  stories: string[];
}

export interface FeIndex {
  endpoints: EndpointNode[];
}
