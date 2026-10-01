import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AnthropicLlmClient, runPatcher } from "@blast/patcher";
import type { Impact } from "@blast/impact";
import type { PatchStat } from "./types.js";

function git(args: string[], cwd: string) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

/**
 * Runs the real patcher against a throwaway git copy of the case's frontend snapshot (same
 * technique as packages/patcher's own tests) so a failed or exploratory eval run never
 * touches the committed case fixture. Real Anthropic API calls -- only invoked when the
 * caller has already confirmed an API key is present (see cli.ts's --with-patches gate).
 */
export async function patchCase(caseName: string, frontendDir: string, exactImpacts: Impact[]): Promise<PatchStat[]> {
  if (exactImpacts.length === 0) {
    return [];
  }

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "blast-eval-patch-"));
  try {
    cpSync(frontendDir, tmpDir, { recursive: true, filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}dist`) });
    execFileSync("ln", ["-s", path.join(frontendDir, "node_modules"), path.join(tmpDir, "node_modules")]);
    git(["init", "-q"], tmpDir);
    git(["config", "user.email", "eval@blast-radius.local"], tmpDir);
    git(["config", "user.name", "Blast Eval"], tmpDir);
    git(["add", "-A"], tmpDir);
    git(["commit", "-q", "-m", "initial"], tmpDir);

    // Impacts carry absolute paths into the ORIGINAL frontendDir; rewrite them onto the
    // throwaway copy so the patcher edits (and verifies against) the disposable copy.
    const rewritten = exactImpacts.map((impact) => ({
      ...impact,
      endpoint: { ...impact.endpoint, file: impact.endpoint.file.replace(frontendDir, tmpDir) },
      sites: impact.sites.map((site) => ({ ...site, file: site.file.replace(frontendDir, tmpDir) })),
    }));

    const llmClient = new AnthropicLlmClient();
    const { fileResults } = await runPatcher({ cwd: tmpDir, impacts: rewritten, llmClient, openPr: false });

    return fileResults.map((result) => ({
      caseName,
      file: path.relative(tmpDir, result.file),
      outcome: result.outcome,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
    }));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
