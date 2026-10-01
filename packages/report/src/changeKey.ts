import type { SpecChange } from "@blast/impact";

/** Stable identity for a SpecChange, used to group multiple Impacts (one per matched endpoint) back into a single "one table per change" section. */
export function changeKey(change: SpecChange): string {
  return [change.kind, change.method, change.path, change.operationId ?? "", change.fieldPath ?? ""].join("::");
}
