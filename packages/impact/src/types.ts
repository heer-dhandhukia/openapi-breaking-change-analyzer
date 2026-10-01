export type ChangeKind =
  | "endpoint-removed"
  | "method-changed"
  | "path-changed"
  | "response-field-removed"
  | "response-field-type-changed"
  | "response-field-became-optional"
  | "enum-value-removed"
  | "request-field-added-required"
  | "request-field-removed"
  | "param-added-required";

export interface SpecChange {
  kind: ChangeKind;
  operationId?: string;
  method: string; // GET, POST ...
  path: string; // /users/{id}
  fieldPath?: string; // e.g. response.200.user.email (exact format TBD in Phase 1, see DECISIONS.md)
  breaking: boolean;
  detail: string; // human-readable
}

export interface UsageSite {
  file: string;
  line: number;
  column: number;
  kind: "endpoint-def" | "hook-call" | "field-access" | "story" | "mutation-arg";
  symbol: string; // e.g. useGetUserQuery, data.user.email
}

export interface Impact {
  change: SpecChange;
  confidence: "exact" | "possible"; // exact = field provably read; possible = spread/passed/any-typed
  endpoint: { name: string; file: string; line: number };
  sites: UsageSite[];
  stories: string[]; // story files that render affected components
}
