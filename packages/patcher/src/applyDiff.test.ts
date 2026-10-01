import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPatch } from "diff";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyUnifiedDiff } from "./applyDiff.js";

let tmpDir: string;
let filePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "blast-applydiff-"));
  filePath = path.join(tmpDir, "file.ts");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("applyUnifiedDiff", () => {
  it("applies a well-formed diff and writes the result back", async () => {
    const before = "export const x = 1;\nexport const y = 2;\n";
    const after = "export const x = 1;\nexport const y = 3;\n";
    writeFileSync(filePath, before);

    const diffText = createPatch("file.ts", before, after);
    const result = await applyUnifiedDiff(filePath, diffText);

    expect(result.applied).toBe(true);
    expect(result.newContent).toBe(after);
    expect(readFileSync(filePath, "utf8")).toBe(after);
  });

  it("returns applied:false and leaves the file untouched when the diff doesn't match the file's content", async () => {
    const before = "export const x = 1;\n";
    writeFileSync(filePath, before);

    const unrelatedDiff = createPatch("file.ts", "totally different content\nline two\n", "totally different content\nline TWO\n");
    const result = await applyUnifiedDiff(filePath, unrelatedDiff);

    expect(result.applied).toBe(false);
    expect(readFileSync(filePath, "utf8")).toBe(before);
  });
});
