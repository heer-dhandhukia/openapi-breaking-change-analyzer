import path from "node:path";
import { fileURLToPath } from "node:url";
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

const kind = process.argv[2] ?? "endpoint-removed";
const head = path.join(specsDir, `head-${kind}.yaml`);

const project = new Project({ tsConfigFilePath });
const feIndex = buildFeIndex(project);
const { changes } = await diffSpecs(v1, head);
const { impacts, unmatched } = matchImpacts(changes, feIndex);

console.log(buildMarkdownReport(impacts, unmatched, [], { rootDir: frontendDir }));
