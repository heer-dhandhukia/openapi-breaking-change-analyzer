import path from "node:path";
import { Project } from "ts-morph";
import { diffSpecs } from "@blast/spec-diff";
import { buildFeIndex } from "@blast/fe-index";
import { matchImpacts, type Impact } from "@blast/impact";
import type { ActualImpact, EvalCase } from "./types.js";

export interface RunCaseResult {
  actual: ActualImpact[];
  unmatchedCount: number;
  pipelineMs: number;
  /** Full Impact[] (not just the scoring projection), for the optional patcher step. */
  impacts: Impact[];
}

export async function runCase(evalCase: EvalCase): Promise<RunCaseResult> {
  const start = performance.now();

  const { changes } = await diffSpecs(evalCase.basePath, evalCase.headPath);
  const project = new Project({ tsConfigFilePath: path.join(evalCase.frontendDir, "tsconfig.json") });
  const feIndex = buildFeIndex(project);
  const { impacts, unmatched } = matchImpacts(changes, feIndex);

  const pipelineMs = performance.now() - start;

  const actual: ActualImpact[] = impacts.map((impact) => ({
    endpoint: impact.endpoint.name,
    kind: impact.change.kind,
    confidence: impact.confidence,
  }));

  return { actual, unmatchedCount: unmatched.length, pipelineMs, impacts };
}
