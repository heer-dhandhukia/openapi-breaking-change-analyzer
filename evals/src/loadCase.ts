import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { EvalCase } from "./types.js";

export function listCaseNames(casesDir: string): string[] {
  return readdirSync(casesDir)
    .filter((name) => statSync(path.join(casesDir, name)).isDirectory())
    .sort();
}

export function loadCase(casesDir: string, name: string): EvalCase {
  const dir = path.join(casesDir, name);
  const expectedFile = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8")) as { expectedImpacts: EvalCase["expected"] };
  return {
    name,
    dir,
    basePath: path.join(dir, "base.yaml"),
    headPath: path.join(dir, "head.yaml"),
    frontendDir: path.join(dir, "frontend"),
    expected: expectedFile.expectedImpacts,
  };
}
