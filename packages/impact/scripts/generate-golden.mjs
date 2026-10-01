// Regenerates packages/impact/test/golden/<kind>.json from the real pipeline. Run after
// any deliberate change to matching behavior; inspect the diff before committing --
// golden files are meant to catch UNINTENDED drift, not to be blindly regenerated.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { Project } from "ts-morph";
import { buildFeIndex } from "../../fe-index/dist/index.js";
import { diffSpecs } from "../../spec-diff/dist/index.js";
import { matchImpacts } from "../dist/index.js";
import { toPortableResult } from "../dist/testSupport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const tsConfigFilePath = path.join(repoRoot, "fixtures", "demo-frontend", "tsconfig.json");
const goldenDir = path.join(here, "..", "test", "golden");

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

const project = new Project({ tsConfigFilePath });
const feIndex = buildFeIndex(project);

for (const kind of kinds) {
  const head = path.join(specsDir, `head-${kind}.yaml`);
  const { changes } = await diffSpecs(v1, head);
  const result = matchImpacts(changes, feIndex);
  const portable = toPortableResult(result, repoRoot);
  const outPath = path.join(goldenDir, `${kind}.json`);
  writeFileSync(outPath, JSON.stringify(portable, null, 2) + "\n");
  console.log(`wrote ${outPath}`);
}
