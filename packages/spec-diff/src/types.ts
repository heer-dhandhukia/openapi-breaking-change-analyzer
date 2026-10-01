// Owned here (spec-diff produces these), re-exported from @blast/impact's types.ts for
// convenience per SPEC.md's "Core types (packages/impact/src/types.ts)" -- keeping the
// definition where it's produced avoids a circular workspace dependency (impact needs
// spec-diff for matching, so spec-diff can't depend back on impact for its own types).
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
