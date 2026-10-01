// Times buildFeIndex against the synthetic repo (generating it first if missing) and
// asserts it completes under 20s, per Phase 1B's performance requirement.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { Project } from "ts-morph";
import { buildFeIndex } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", ".synthetic-repo");
const BUDGET_MS = 20_000;

if (!existsSync(outDir)) {
  execFileSync("node", [path.join(here, "generate-synthetic-repo.mjs"), outDir], { stdio: "inherit" });
}

const tsConfigFilePath = path.join(outDir, "tsconfig.json");

const projectStart = performance.now();
const project = new Project({ tsConfigFilePath });
const projectLoadedMs = performance.now() - projectStart;

const indexStart = performance.now();
const index = buildFeIndex(project);
const indexMs = performance.now() - indexStart;

const totalMs = projectLoadedMs + indexMs;
const totalSites = index.endpoints.reduce((sum, n) => sum + n.sites.length, 0);
const fileCount = project.getSourceFiles().length;

console.log(`files indexed:      ${fileCount}`);
console.log(`endpoints found:    ${index.endpoints.length}`);
console.log(`usage sites found:  ${totalSites}`);
console.log(`project load time:  ${projectLoadedMs.toFixed(0)}ms`);
console.log(`buildFeIndex time:  ${indexMs.toFixed(0)}ms`);
console.log(`total time:         ${totalMs.toFixed(0)}ms (budget: ${BUDGET_MS}ms)`);

if (totalMs > BUDGET_MS) {
  console.error(`FAIL: indexing took ${totalMs.toFixed(0)}ms, over the ${BUDGET_MS}ms budget`);
  process.exit(1);
}
console.log("PASS");
