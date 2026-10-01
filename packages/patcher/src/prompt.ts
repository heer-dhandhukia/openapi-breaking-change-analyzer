import type { PatchRequest, VerifyResult } from "./types.js";

function describeChange(impact: PatchRequest["impacts"][number]): string {
  const { change } = impact;
  const field = change.fieldPath ? ` (field: ${change.fieldPath})` : "";
  return `- [${change.kind}] ${change.method} ${change.path}${field}: ${change.detail}`;
}

function describeSites(impact: PatchRequest["impacts"][number]): string[] {
  return impact.sites.map((site) => `  - ${site.kind} \`${site.symbol}\` at ${site.file}:${site.line}`);
}

export function buildPrompt(request: PatchRequest): string {
  const changesSection = request.impacts.map(describeChange).join("\n");
  const sitesSection = request.impacts.flatMap(describeSites).join("\n");

  return `You are fixing a TypeScript React file whose backend API changed in a way that breaks it.

## API changes affecting this file
${changesSection}

## Affected usage sites in this file
${sitesSection}

## File: ${request.file}
\`\`\`tsx
${request.fileContent}
\`\`\`
${request.relevantTypes ? `\n## Relevant types\n\`\`\`ts\n${request.relevantTypes}\n\`\`\`\n` : ""}
Fix ONLY what's needed so this file compiles and behaves correctly against the new API shape. Make the smallest change that does this -- don't refactor unrelated code.

Return ONLY a unified diff (git-style: \`--- a/<path>\` / \`+++ b/<path>\` headers, \`@@\` hunks) that applies cleanly to the file above. No explanation, no markdown fences, no commentary before or after the diff.`;
}

export function buildRetryPrompt(request: PatchRequest, previousDiff: string, verify: VerifyResult): string {
  return `Your previous patch didn't verify. Here's what you sent:

\`\`\`diff
${previousDiff}
\`\`\`

Verification output (tsc/tests):
\`\`\`
${verify.output}
\`\`\`

Here is the ORIGINAL file again for reference:

## File: ${request.file}
\`\`\`tsx
${request.fileContent}
\`\`\`

Send a corrected unified diff against the ORIGINAL file above (not against your previous patch). Same rules as before: smallest change that fixes it, diff only, no commentary.`;
}
