import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface OpenDraftPrOptions {
  cwd: string;
  branch: string;
  baseBranch: string;
  title: string;
  body: string;
}

export type ExecFileFn = (command: string, args: string[], options: { cwd: string }) => Promise<{ stdout: string; stderr: string }>;

/**
 * Pushes the scratch branch and opens a draft PR via the `gh` CLI (consistent with Phase 3
 * -- no octokit dependency). `exec` is injectable so this can be unit-tested by asserting
 * the exact git/gh commands built, without a real push or a real GitHub API call -- opening
 * a real PR needs a real remote and is not something to do implicitly under test. Never
 * pushes to `baseBranch`, never merges.
 */
export async function pushAndOpenDraftPr(options: OpenDraftPrOptions, exec: ExecFileFn = execFileAsync): Promise<string> {
  await exec("git", ["push", "-u", "origin", options.branch], { cwd: options.cwd });
  const { stdout } = await exec(
    "gh",
    ["pr", "create", "--draft", "--base", options.baseBranch, "--head", options.branch, "--title", options.title, "--body", options.body],
    { cwd: options.cwd },
  );
  return stdout.trim(); // `gh pr create` prints the PR URL on success
}
