// Bootstraps evals/cases/<kind>/ from the fixtures already built and verified in Phases
// 0-2: fixtures/specs/{v1,head-<kind>}.yaml become base.yaml/head.yaml, a real snapshot
// copy of fixtures/demo-frontend becomes frontend/, and expected.json is derived from
// packages/impact/test/golden/<kind>.json (already-verified ground truth -- see
// DECISIONS.md for why re-deriving it by hand would just duplicate that work). Each case
// is a real, self-contained snapshot (not a symlink) so a later change to
// fixtures/demo-frontend can't silently drift an existing eval baseline -- see
// evals/README.md.
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const frontendSrc = path.join(repoRoot, "fixtures", "demo-frontend");
const goldenDir = path.join(repoRoot, "packages", "impact", "test", "golden");
const casesDir = path.join(here, "..", "cases");

const kinds = [
  "endpoint-removed",
  "method-changed",
  "path-changed",
  "response-field-removed",
  "response-field-type-changed",
  "response-field-became-optional",
  "enum-value-removed",
  "request-field-added-required",
  "request-field-removed",
  "param-added-required",
];

for (const kind of kinds) {
  const caseDir = path.join(casesDir, kind);
  rmSync(caseDir, { recursive: true, force: true });
  mkdirSync(caseDir, { recursive: true });

  cpSync(path.join(specsDir, "v1.yaml"), path.join(caseDir, "base.yaml"));
  cpSync(path.join(specsDir, `head-${kind}.yaml`), path.join(caseDir, "head.yaml"));

  const frontendDest = path.join(caseDir, "frontend");
  cpSync(frontendSrc, frontendDest, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}dist`),
  });
  // Symlinked (not copied): keeps 10 case snapshots cheap and consistent with how the
  // golden files themselves were generated (real fixtures/demo-frontend deps), rather than
  // each case silently drifting to whatever `node_modules` happened to be missing.
  symlinkSync(path.join(frontendSrc, "node_modules"), path.join(frontendDest, "node_modules"));

  const golden = JSON.parse(readFileSync(path.join(goldenDir, `${kind}.json`), "utf8"));
  const expectedImpacts = golden.impacts.map((impact) => ({
    endpoint: impact.endpoint.name,
    kind: impact.change.kind,
    confidence: impact.confidence,
  }));
  writeFileSync(path.join(caseDir, "expected.json"), JSON.stringify({ expectedImpacts }, null, 2) + "\n");

  console.log(`generated evals/cases/${kind} (${expectedImpacts.length} expected impact${expectedImpacts.length === 1 ? "" : "s"})`);
}
