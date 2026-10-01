import type { EndpointNode, FeIndex, FeUsageSite } from "@blast/fe-index";
import { normalizePathParams } from "@blast/spec-diff";
import type { Impact, SpecChange } from "./types.js";

export interface MatchResult {
  impacts: Impact[];
  /** Changes that couldn't be tied to any endpoint fe-index found in the frontend repo(s). Never dropped. */
  unmatched: SpecChange[];
}

function findCandidateEndpoints(change: SpecChange, feIndex: FeIndex): EndpointNode[] {
  if (change.operationId) {
    const byOperationId = feIndex.endpoints.filter((node) => node.endpoint.operationId === change.operationId);
    if (byOperationId.length > 0) {
      return byOperationId;
    }
  }
  const changePath = normalizePathParams(change.path);
  return feIndex.endpoints.filter((node) => node.endpoint.method === change.method && normalizePathParams(node.endpoint.path) === changePath);
}

/** Last dot-segment of a dotted field path, with a trailing `[]` stripped -- e.g. "response.200.users[].role" -> "role". */
function leafName(dottedPath: string): string {
  const segments = dottedPath.split(".");
  const last = segments[segments.length - 1] ?? dottedPath;
  return last.replace(/\[\]$/, "");
}

/** True for a bare container symbol like "posts[]" (a spread with no resolvable field name), not a real field access. */
function isOpaqueContainerSymbol(symbol: string): boolean {
  const last = symbol.split(".").pop() ?? symbol;
  return last.endsWith("[]");
}

function buildImpact(change: SpecChange, node: EndpointNode, sites: FeUsageSite[], confidence: "exact" | "possible"): Impact {
  return {
    change,
    confidence,
    endpoint: { name: node.endpoint.name, file: node.endpoint.file, line: node.endpoint.line },
    sites,
    stories: node.stories,
  };
}

function matchEndpointIdentityChange(change: SpecChange, node: EndpointNode): Impact | undefined {
  const relevantSites = node.sites.filter((site) => site.kind !== "endpoint-def");
  if (relevantSites.length === 0) {
    return undefined; // known endpoint, but nothing in this frontend actually calls it
  }
  const confidence = relevantSites.some((site) => site.confidence === "exact") ? "exact" : "possible";
  return buildImpact(change, node, relevantSites, confidence);
}

function matchFieldLevelChange(change: SpecChange, node: EndpointNode): Impact | undefined {
  if (!change.fieldPath) {
    return undefined; // shouldn't happen for these kinds, but never guess a field we don't have
  }
  const leaf = leafName(change.fieldPath);
  const fieldSites = node.sites.filter((site) => site.kind === "field-access");

  const exactMatches = fieldSites.filter((site) => site.confidence === "exact" && leafName(site.symbol) === leaf);
  if (exactMatches.length > 0) {
    return buildImpact(change, node, exactMatches, "exact");
  }

  const possibleMatches = fieldSites.filter((site) => site.confidence === "possible" && leafName(site.symbol) === leaf);
  // A spread/wrapper with no resolvable field name (e.g. "posts[]") could still be
  // carrying the changed field -- prefer a false 'possible' over silently missing it.
  const opaqueMatches = fieldSites.filter((site) => site.confidence === "possible" && isOpaqueContainerSymbol(site.symbol));
  const possibleSites = [...possibleMatches, ...opaqueMatches];

  if (possibleSites.length > 0) {
    return buildImpact(change, node, possibleSites, "possible");
  }

  return undefined; // endpoint is used, but nothing touches this field
}

// A change either breaks *any* call to the endpoint (its identity/shape changed) or only
// breaks code that reads one specific field off the response -- handled by the two
// functions above respectively. A switch (not a Set.has lookup) so TS's exhaustiveness
// check catches a future ChangeKind that isn't assigned to either category.
function classify(change: SpecChange, node: EndpointNode): Impact | undefined {
  switch (change.kind) {
    case "endpoint-removed":
    case "method-changed":
    case "path-changed":
    case "param-added-required":
    case "request-field-added-required":
    case "request-field-removed":
      return matchEndpointIdentityChange(change, node);
    case "response-field-removed":
    case "response-field-type-changed":
    case "response-field-became-optional":
    case "enum-value-removed":
      return matchFieldLevelChange(change, node);
    default: {
      const exhaustive: never = change.kind;
      throw new Error(`unhandled ChangeKind: ${String(exhaustive)} -- add it to classify() in match.ts`);
    }
  }
}

export function matchImpacts(changes: SpecChange[], feIndex: FeIndex): MatchResult {
  const impacts: Impact[] = [];
  const unmatched: SpecChange[] = [];

  for (const change of changes) {
    const candidates = findCandidateEndpoints(change, feIndex);
    if (candidates.length === 0) {
      unmatched.push(change);
      continue;
    }

    for (const node of candidates) {
      const impact = classify(change, node);
      if (impact) {
        impacts.push(impact);
      }
    }
  }

  return { impacts, unmatched };
}
