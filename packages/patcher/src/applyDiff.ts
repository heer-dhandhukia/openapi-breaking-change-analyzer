import { readFile, writeFile } from "node:fs/promises";
import { applyPatch } from "diff";

export interface ApplyDiffResult {
  applied: boolean;
  newContent?: string;
}

/** Applies a unified diff to the file at `filePath`, writing the result back if it applies cleanly. */
export async function applyUnifiedDiff(filePath: string, diffText: string): Promise<ApplyDiffResult> {
  const original = await readFile(filePath, "utf8");
  const patched = applyPatch(original, diffText);
  if (patched === false) {
    return { applied: false };
  }
  await writeFile(filePath, patched, "utf8");
  return { applied: true, newContent: patched };
}
