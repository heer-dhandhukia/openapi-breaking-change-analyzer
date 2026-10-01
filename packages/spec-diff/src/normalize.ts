import type { ChangeKind, SpecChange } from "./types.js";
import type { RawOasdiffChange } from "./oasdiffTypes.js";
import { normalizePathParams } from "./pathParams.js";

export interface NormalizeResult {
  changes: SpecChange[];
  /** oasdiff changes we recognize but can't map to a ChangeKind yet. Never dropped. */
  unmapped: RawOasdiffChange[];
}

// oasdiff has no dedicated id for "a whole path disappeared" vs "one operation on a path
// disappeared" in a way that maps 1:1 to our endpoint-removed/method-changed/path-changed
// split -- both show up as one of these ids, paired (or not) with a separate
// `endpoint-added` for the same operationId. See DECISIONS.md.
const REMOVAL_IDS = new Set(["api-path-removed-without-deprecation", "api-removed-without-deprecation"]);
const ADDITION_ID = "endpoint-added";

// Recognized but deliberately not surfaced as a SpecChange or as "unmapped": these are
// either pure metadata about the diff itself (not a change to the API surface) or the
// non-breaking half of a removal+addition pair that either got correlated into a single
// method-changed/path-changed SpecChange, or represents a genuinely new endpoint (nothing
// in an existing frontend can depend on an endpoint that didn't exist before). See
// DECISIONS.md.
const IGNORED_IDS = new Set(["api-major-version-not-bumped", ADDITION_ID]);

interface FieldExtraction {
  fieldPath: string;
  extra?: string;
}

type FieldExtractor = (text: string) => FieldExtraction | undefined;

function normalizeRawFieldPath(raw: string): string {
  const tokens = raw.split("/").map((part) => (part === "items" ? "[]" : part));
  let result = "";
  for (const token of tokens) {
    if (token === "[]") {
      result += "[]";
    } else if (result === "") {
      result = token;
    } else {
      result += `.${token}`;
    }
  }
  return result;
}

const RESPONSE_REQUIRED_PROPERTY_REMOVED_RE = /^removed the required property `([^`]+)` from the response with the `([^`]+)` status$/;
const RESPONSE_PROPERTY_TYPE_CHANGED_RE = /^the `([^`]+)` response's property `type` changed from `([^`]+)` to `([^`]+)` for status `([^`]+)`$/;
const RESPONSE_PROPERTY_BECAME_OPTIONAL_RE = /^the response property `([^`]+)` became optional for the status `([^`]+)`$/;
const RESPONSE_PROPERTY_ENUM_VALUE_REMOVED_RE = /^removed the `([^`]+)` enum value from the `([^`]+)` response property for the response status `([^`]+)`$/;
const NEW_REQUIRED_REQUEST_PROPERTY_RE = /^added the new required request property `([^`]+)`$/;
const REQUEST_PROPERTY_REMOVED_RE = /^removed the request property `([^`]+)`$/;
const NEW_REQUIRED_REQUEST_PARAMETER_RE = /^added the new required `([^`]+)` request parameter `([^`]+)`$/;

// One extractor per mapped oasdiff id, parsing the field path (and any extra detail, e.g.
// the removed enum value) out of `text` since oasdiff doesn't expose it as structured
// JSON. Regexes are anchored to the exact wording oasdiff v1.32.1 uses (see the fixture
// runs this was built against) -- if a future oasdiff version rewords a message, the
// extractor returns undefined and the raw change falls through to "unmapped" rather than
// producing a wrong fieldPath.
const FIELD_EXTRACTORS: Partial<Record<string, FieldExtractor>> = {
  "response-required-property-removed": (text) => {
    const match = RESPONSE_REQUIRED_PROPERTY_REMOVED_RE.exec(text);
    if (!match) return undefined;
    const [, rawPath, status] = match;
    return { fieldPath: `response.${status}.${normalizeRawFieldPath(rawPath!)}` };
  },
  "response-property-type-changed": (text) => {
    const match = RESPONSE_PROPERTY_TYPE_CHANGED_RE.exec(text);
    if (!match) return undefined;
    const [, rawPath, from, to, status] = match;
    return { fieldPath: `response.${status}.${normalizeRawFieldPath(rawPath!)}`, extra: `${from ?? "?"} -> ${to ?? "?"}` };
  },
  "response-property-became-optional": (text) => {
    const match = RESPONSE_PROPERTY_BECAME_OPTIONAL_RE.exec(text);
    if (!match) return undefined;
    const [, rawPath, status] = match;
    return { fieldPath: `response.${status}.${normalizeRawFieldPath(rawPath!)}` };
  },
  "response-property-enum-value-removed": (text) => {
    const match = RESPONSE_PROPERTY_ENUM_VALUE_REMOVED_RE.exec(text);
    if (!match) return undefined;
    const [, value, rawPath, status] = match;
    return { fieldPath: `response.${status}.${normalizeRawFieldPath(rawPath!)}`, extra: value ?? "" };
  },
  "new-required-request-property": (text) => {
    const match = NEW_REQUIRED_REQUEST_PROPERTY_RE.exec(text);
    if (!match) return undefined;
    const [, rawPath] = match;
    return { fieldPath: `request.body.${normalizeRawFieldPath(rawPath!)}` };
  },
  "request-property-removed": (text) => {
    const match = REQUEST_PROPERTY_REMOVED_RE.exec(text);
    if (!match) return undefined;
    const [, rawPath] = match;
    return { fieldPath: `request.body.${normalizeRawFieldPath(rawPath!)}` };
  },
  "new-required-request-parameter": (text) => {
    const match = NEW_REQUIRED_REQUEST_PARAMETER_RE.exec(text);
    if (!match) return undefined;
    const [, location, name] = match;
    return { fieldPath: `request.${location}.${name}` };
  },
};

// The full oasdiff-change-id -> ChangeKind mapping. Kept alongside FIELD_EXTRACTORS above;
// the authoritative copy (with rationale) lives in DECISIONS.md.
const ID_TO_KIND: Partial<Record<string, ChangeKind>> = {
  "response-required-property-removed": "response-field-removed",
  "response-property-type-changed": "response-field-type-changed",
  "response-property-became-optional": "response-field-became-optional",
  "response-property-enum-value-removed": "enum-value-removed",
  "new-required-request-property": "request-field-added-required",
  "request-property-removed": "request-field-removed",
  "new-required-request-parameter": "param-added-required",
};

function isBreaking(level: number): boolean {
  return level >= 2;
}

function buildDirectChange(raw: RawOasdiffChange, kind: ChangeKind): SpecChange | undefined {
  if (!raw.operation || !raw.path) {
    return undefined;
  }
  const extractor = FIELD_EXTRACTORS[raw.id];
  const extraction = extractor?.(raw.text);
  const detail = extraction?.extra ? `${raw.text} (${extraction.extra})` : raw.text;
  return {
    kind,
    ...(raw.operationId ? { operationId: raw.operationId } : {}),
    method: raw.operation,
    path: normalizePathParams(raw.path),
    ...(extraction?.fieldPath ? { fieldPath: extraction.fieldPath } : {}),
    breaking: isBreaking(raw.level),
    detail,
  };
}

function buildEndpointRemoved(removal: RawOasdiffChange): SpecChange | undefined {
  if (!removal.operation || !removal.path) {
    return undefined;
  }
  return {
    kind: "endpoint-removed",
    ...(removal.operationId ? { operationId: removal.operationId } : {}),
    method: removal.operation,
    path: normalizePathParams(removal.path),
    breaking: isBreaking(removal.level),
    detail: removal.text,
  };
}

function buildCorrelatedChange(removal: RawOasdiffChange, addition: RawOasdiffChange): SpecChange | undefined {
  if (!removal.operation || !removal.path || !addition.operation || !addition.path) {
    return undefined;
  }
  const oldPath = normalizePathParams(removal.path);
  const newPath = normalizePathParams(addition.path);
  const methodChanged = removal.operation !== addition.operation;
  const pathChanged = oldPath !== newPath;

  // Both differing at once is ambiguous (not exercised by any fixture); fall back to
  // reporting the removal as a plain endpoint-removed rather than guessing which kind
  // best describes it.
  if (methodChanged && pathChanged) {
    return buildEndpointRemoved(removal);
  }

  const operationId = removal.operationId ?? addition.operationId;

  // Report the change at the endpoint's OLD (base) method+path, not the new one: existing
  // frontend code still calls the old shape -- that's the identity Phase 2 impact matching
  // needs to find the frontend usage that's about to break. The new shape is still useful
  // context, so it goes in `detail`.
  if (methodChanged) {
    return {
      kind: "method-changed",
      ...(operationId ? { operationId } : {}),
      method: removal.operation,
      path: oldPath,
      breaking: isBreaking(removal.level),
      detail: `${removal.text} (now ${addition.operation} ${newPath})`,
    };
  }

  return {
    kind: "path-changed",
    ...(operationId ? { operationId } : {}),
    method: removal.operation,
    path: oldPath,
    breaking: isBreaking(removal.level),
    detail: `${removal.text} (now ${newPath})`,
  };
}

export function normalizeChanges(raw: RawOasdiffChange[]): NormalizeResult {
  const changes: SpecChange[] = [];
  const unmapped: RawOasdiffChange[] = [];

  const removals = raw.filter((change) => REMOVAL_IDS.has(change.id));
  const additions = raw.filter((change) => change.id === ADDITION_ID);
  const consumedAdditions = new Set<RawOasdiffChange>();

  for (const removal of removals) {
    const correlatedAddition = removal.operationId
      ? additions.find((addition) => !consumedAdditions.has(addition) && addition.operationId === removal.operationId)
      : undefined;

    if (correlatedAddition) {
      consumedAdditions.add(correlatedAddition);
      const change = buildCorrelatedChange(removal, correlatedAddition);
      if (change) {
        changes.push(change);
        continue;
      }
    }

    const change = buildEndpointRemoved(removal);
    if (change) {
      changes.push(change);
    } else {
      unmapped.push(removal);
    }
  }

  for (const raw2 of raw) {
    if (REMOVAL_IDS.has(raw2.id) || raw2.id === ADDITION_ID) {
      continue; // handled above (correlated, turned into endpoint-removed, or ignored)
    }
    if (IGNORED_IDS.has(raw2.id)) {
      continue;
    }

    const kind = ID_TO_KIND[raw2.id];
    if (!kind) {
      unmapped.push(raw2);
      continue;
    }

    const change = buildDirectChange(raw2, kind);
    if (change) {
      changes.push(change);
    } else {
      unmapped.push(raw2);
    }
  }

  return { changes, unmapped };
}
