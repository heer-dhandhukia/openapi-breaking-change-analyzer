import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { buildFeIndex } from "../../fe-index/dist/index.js";
import { diffSpecs } from "../../spec-diff/dist/index.js";
import { matchImpacts } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.join(here, "..", "..", "..", "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const tsConfigFilePath = path.join(here, "..", "..", "..", "fixtures", "demo-frontend", "tsconfig.json");

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
  const { changes, unmapped } = await diffSpecs(v1, head);
  const { impacts, unmatched } = matchImpacts(changes, feIndex);

  console.log("=".repeat(70));
  console.log(kind, `(${changes.length} changes, ${unmapped.length} unmapped-from-oasdiff)`);
  console.log(`  -> ${impacts.length} impacts, ${unmatched.length} unmatched`);
  for (const impact of impacts) {
    console.log(`  [${impact.confidence}] endpoint=${impact.endpoint.name} breaking=${impact.change.breaking} sites=${impact.sites.length} stories=${impact.stories.length}`);
    for (const site of impact.sites) {
      console.log(`      ${site.kind} ${site.symbol} @ ${site.file.split("/").pop()}:${site.line}`);
    }
  }
  for (const change of unmatched) {
    console.log(`  UNMATCHED: ${change.kind} ${change.method} ${change.path} (opId=${change.operationId})`);
  }
}
