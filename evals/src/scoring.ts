import type { ActualImpact, CaseScore, ConfusionCounts, ExpectedImpact } from "./types.js";

function key(item: { endpoint: string; kind: string }): string {
  return `${item.endpoint}::${item.kind}`;
}

/**
 * Scores one confidence bucket (exact or possible) as a strict, non-overlapping confusion
 * matrix: a true positive requires the actual confidence to match the expected confidence
 * exactly, not just "at least as good". An `exact` impact found where `possible` was
 * expected doesn't count as a possible-bucket hit -- it's a different, stronger claim. See
 * evals/README.md for the rationale and what this does and doesn't capture.
 */
function scoreBucket(expected: ExpectedImpact[], actual: ActualImpact[], confidence: "exact" | "possible"): ConfusionCounts {
  const expectedKeys = new Set(expected.filter((e) => e.confidence === confidence).map(key));
  const actualKeys = new Set(actual.filter((a) => a.confidence === confidence).map(key));

  let truePositives = 0;
  for (const k of expectedKeys) {
    if (actualKeys.has(k)) truePositives++;
  }
  const falseNegatives = expectedKeys.size - truePositives;
  const falsePositives = [...actualKeys].filter((k) => !expectedKeys.has(k)).length;

  return { truePositives, falsePositives, falseNegatives };
}

export function scoreCase(caseName: string, expected: ExpectedImpact[], actual: ActualImpact[], unmatchedCount: number, pipelineMs: number): CaseScore {
  return {
    caseName,
    exact: scoreBucket(expected, actual, "exact"),
    possible: scoreBucket(expected, actual, "possible"),
    unmatchedCount,
    pipelineMs,
  };
}

export function precisionOf(counts: ConfusionCounts): number {
  const denom = counts.truePositives + counts.falsePositives;
  return denom === 0 ? 1 : counts.truePositives / denom;
}

export function recallOf(counts: ConfusionCounts): number {
  const denom = counts.truePositives + counts.falseNegatives;
  return denom === 0 ? 1 : counts.truePositives / denom;
}

export function sumCounts(counts: ConfusionCounts[]): ConfusionCounts {
  return counts.reduce((acc, c) => ({ truePositives: acc.truePositives + c.truePositives, falsePositives: acc.falsePositives + c.falsePositives, falseNegatives: acc.falseNegatives + c.falseNegatives }), {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
  });
}
