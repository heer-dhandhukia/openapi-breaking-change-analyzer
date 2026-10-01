import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function createScratchBranch(cwd: string, branchName: string): Promise<void> {
  await execFileAsync("git", ["checkout", "-b", branchName], { cwd });
}

export async function commitAll(cwd: string, message: string): Promise<void> {
  await execFileAsync("git", ["add", "-A"], { cwd });
  await execFileAsync("git", ["commit", "-m", message], { cwd });
}

/** Discards uncommitted changes (a failed, unverified patch attempt) so the next retry starts clean. */
export async function discardUncommittedChanges(cwd: string): Promise<void> {
  await execFileAsync("git", ["checkout", "--", "."], { cwd });
  await execFileAsync("git", ["clean", "-fd"], { cwd });
}

export async function currentBranch(cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  return stdout.trim();
}
