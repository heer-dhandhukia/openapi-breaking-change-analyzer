import type { ChangeKind } from "@blast/spec-diff";

/** Ground truth for one case: minimal on purpose (endpoint + kind + confidence), not full
 * `Impact` objects -- robust to oasdiff wording changes and easy to hand-author for new
 * cases, per evals/README.md. */
export interface ExpectedImpact {
  endpoint: string;
  kind: ChangeKind;
  confidence: "exact" | "possible";
}

export interface ExpectedFile {
  expectedImpacts: ExpectedImpact[];
}

export interface EvalCase {
  name: string;
  dir: string;
  basePath: string;
  headPath: string;
  frontendDir: string;
  expected: ExpectedImpact[];
}

export interface ActualImpact {
  endpoint: string;
  kind: ChangeKind;
  confidence: "exact" | "possible";
}

export interface ConfusionCounts {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface CaseScore {
  caseName: string;
  exact: ConfusionCounts;
  possible: ConfusionCounts;
  unmatchedCount: number;
  pipelineMs: number;
}

export interface PatchStat {
  caseName: string;
  file: string;
  outcome: "verified" | "needs-human";
  costUsd: number;
  durationMs: number;
}

export interface EvalSummary {
  cases: CaseScore[];
  patchStats: PatchStat[];
  patchingSkippedReason?: string;
}
