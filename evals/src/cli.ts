import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Impact } from "@blast/impact";
import { listCaseNames, loadCase } from "./loadCase.js";
import { patchCase } from "./patchCase.js";
import { printReport } from "./report.js";
import { runCase } from "./runCase.js";
import { scoreCase } from "./scoring.js";
import type { CaseScore, EvalSummary, PatchStat } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const casesDir = path.join(here, "..", "cases");

// Running the real patcher spends real API money -- opt-in only, never implied by an
// API key merely being present in the environment. See evals/README.md.
const withPatches = process.argv.includes("--with-patches");

async function main(): Promise<void> {
  const caseNames = listCaseNames(casesDir);
  if (caseNames.length === 0) {
    console.error(`No eval cases found in ${casesDir}. Run \`pnpm gen:cases\` first, or add cases per evals/README.md.`);
    process.exitCode = 1;
    return;
  }

  const caseScores: CaseScore[] = [];
  const exactImpactsByCase: Array<{ name: string; frontendDir: string; impacts: Impact[] }> = [];

  for (const name of caseNames) {
    const evalCase = loadCase(casesDir, name);
    const { actual, unmatchedCount, pipelineMs, impacts } = await runCase(evalCase);
    caseScores.push(scoreCase(name, evalCase.expected, actual, unmatchedCount, pipelineMs));
    exactImpactsByCase.push({ name, frontendDir: evalCase.frontendDir, impacts: impacts.filter((i) => i.confidence === "exact") });
  }

  const summary: EvalSummary = { cases: caseScores, patchStats: [] };

  if (!withPatches) {
    summary.patchingSkippedReason = "Skipped (pass --with-patches to run the real patcher and spend real API calls).";
  } else if (!process.env.ANTHROPIC_API_KEY) {
    summary.patchingSkippedReason = "Skipped: --with-patches was given but ANTHROPIC_API_KEY is not set.";
  } else {
    const patchStats: PatchStat[] = [];
    for (const { name, frontendDir, impacts } of exactImpactsByCase) {
      patchStats.push(...(await patchCase(name, frontendDir, impacts)));
    }
    summary.patchStats = patchStats;
  }

  printReport(summary);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
