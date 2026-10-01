import type { ChangeKind, Impact } from "@blast/impact";

// Changes to the endpoint's own call shape (method, path, params, request body) need the
// endpoint definition's own file updated too (the query URL template / method string), not
// just consumer files. `endpoint-removed` is deliberately excluded: there's no in-place fix
// to make in the definition itself (the operation is just gone) -- only consumer sites can
// meaningfully be patched.
const ENDPOINT_DEFINITION_NEEDS_FIX: ReadonlySet<ChangeKind> = new Set(["method-changed", "path-changed", "param-added-required", "request-field-added-required", "request-field-removed"]);

/**
 * Groups every `exact` Impact by the file(s) that need to change to fix it: every usage
 * site's file (excluding the purely-informational `endpoint-def` site), plus the endpoint
 * definition's own file for changes to the endpoint's call shape (see above).
 */
export function groupExactImpactsByFile(impacts: Impact[]): Map<string, Impact[]> {
  const byFile = new Map<string, Impact[]>();

  const addTo = (file: string, impact: Impact) => {
    const existing = byFile.get(file);
    if (existing) {
      if (!existing.includes(impact)) existing.push(impact);
    } else {
      byFile.set(file, [impact]);
    }
  };

  for (const impact of impacts) {
    if (impact.confidence !== "exact") continue;

    for (const site of impact.sites) {
      if (site.kind === "endpoint-def") continue;
      addTo(site.file, impact);
    }

    if (ENDPOINT_DEFINITION_NEEDS_FIX.has(impact.change.kind)) {
      addTo(impact.endpoint.file, impact);
    }
  }

  return byFile;
}
