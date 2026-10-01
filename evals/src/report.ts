import { precisionOf, recallOf, sumCounts } from "./scoring.js";
import type { EvalSummary } from "./types.js";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function printReport(summary: EvalSummary): void {
  console.log(`\n${"=".repeat(70)}\nAPI Blast Radius -- eval results (${summary.cases.length} case${summary.cases.length === 1 ? "" : "s"})\n${"=".repeat(70)}\n`);

  for (const c of summary.cases) {
    console.log(`${c.caseName}`);
    console.log(`  exact:    TP=${c.exact.truePositives} FP=${c.exact.falsePositives} FN=${c.exact.falseNegatives}`);
    console.log(`  possible: TP=${c.possible.truePositives} FP=${c.possible.falsePositives} FN=${c.possible.falseNegatives}`);
    console.log(`  unmatched changes: ${c.unmatchedCount}, pipeline: ${c.pipelineMs.toFixed(0)}ms`);
  }

  const exactTotal = sumCounts(summary.cases.map((c) => c.exact));
  const possibleTotal = sumCounts(summary.cases.map((c) => c.possible));
  const avgPipelineMs = summary.cases.reduce((sum, c) => sum + c.pipelineMs, 0) / Math.max(summary.cases.length, 1);

  console.log(`\n${"-".repeat(70)}\nAggregate (micro-averaged across all cases)\n${"-".repeat(70)}`);
  console.log(`exact    precision=${pct(precisionOf(exactTotal))} recall=${pct(recallOf(exactTotal))}  (TP=${exactTotal.truePositives} FP=${exactTotal.falsePositives} FN=${exactTotal.falseNegatives})`);
  console.log(`possible precision=${pct(precisionOf(possibleTotal))} recall=${pct(recallOf(possibleTotal))}  (TP=${possibleTotal.truePositives} FP=${possibleTotal.falsePositives} FN=${possibleTotal.falseNegatives})`);
  console.log(`avg pipeline time: ${avgPipelineMs.toFixed(0)}ms`);

  console.log(`\n${"-".repeat(70)}\nPatch verification\n${"-".repeat(70)}`);
  if (summary.patchingSkippedReason) {
    console.log(summary.patchingSkippedReason);
  } else if (summary.patchStats.length === 0) {
    console.log("No exact impacts to patch across any case.");
  } else {
    const verified = summary.patchStats.filter((s) => s.outcome === "verified").length;
    const verifyPassRate = verified / summary.patchStats.length;
    const avgCost = summary.patchStats.reduce((sum, s) => sum + s.costUsd, 0) / summary.patchStats.length;
    const avgDurationMs = summary.patchStats.reduce((sum, s) => sum + s.durationMs, 0) / summary.patchStats.length;
    console.log(`verify-pass rate: ${pct(verifyPassRate)} (${verified}/${summary.patchStats.length} files)`);
    console.log(`avg cost per file: $${avgCost.toFixed(4)}`);
    console.log(`avg time per file: ${avgDurationMs.toFixed(0)}ms`);
    for (const stat of summary.patchStats) {
      console.log(`  [${stat.outcome}] ${stat.caseName}/${stat.file} ($${stat.costUsd.toFixed(4)}, ${stat.durationMs.toFixed(0)}ms)`);
    }
  }
  console.log();
}
