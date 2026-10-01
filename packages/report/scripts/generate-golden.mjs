// Regenerates packages/report/test/golden/<kind>.md from the real pipeline. Inspect the
// diff before committing -- golden files are meant to catch UNINTENDED drift.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { Project } from "ts-morph";
import { buildFeIndex } from "../../fe-index/dist/index.js";
import { diffSpecs } from "../../spec-diff/dist/index.js";
import { matchImpacts } from "../../impact/dist/index.js";
import { buildMarkdownReport } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const frontendDir = path.join(repoRoot, "fixtures", "demo-frontend");
const tsConfigFilePath = path.join(frontendDir, "tsconfig.json");
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
  const { impacts, unmatched } = matchImpacts(changes, feIndex);
  const markdown = buildMarkdownReport(impacts, unmatched, [], { rootDir: frontendDir });
  const outPath = path.join(goldenDir, `${kind}.md`);
  writeFileSync(outPath, markdown);
  console.log(`wrote ${outPath}`);
}
