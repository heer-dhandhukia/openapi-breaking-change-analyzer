import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RawOasdiffChange } from "./oasdiffTypes.js";

const execFileAsync = promisify(execFile);

export interface RunChangelogOptions {
  /** Overrides the resolved binary path (mainly for tests). */
  binPath?: string;
}

function resolveBinPath(options: RunChangelogOptions): string {
  return options.binPath ?? process.env.OASDIFF_BIN ?? "oasdiff";
}

/**
 * Runs `oasdiff changelog <base> <revision> -f json` and parses the result.
 *
 * Confirmed against the real binary (v1.32.1, `oasdiff schema`): on success it prints a
 * JSON array to stdout (`[]` when there are no changes, exit code 0 either way); on
 * failure (e.g. a missing file) it prints a plain-text error to stderr and exits non-zero.
 */
export async function runChangelog(
  basePath: string,
  revisionPath: string,
  options: RunChangelogOptions = {},
): Promise<RawOasdiffChange[]> {
  const bin = resolveBinPath(options);

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(bin, ["changelog", basePath, revisionPath, "-f", "json"]));
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String((error as { stderr: unknown }).stderr) : "";
    throw new Error(`oasdiff changelog failed for ${basePath} -> ${revisionPath}: ${stderr || String(error)}`);
  }

  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return JSON.parse(trimmed) as RawOasdiffChange[];
}
