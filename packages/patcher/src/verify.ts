import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VerifyResult } from "./types.js";

const execFileAsync = promisify(execFile);

export interface VerifyOptions {
  /** The frontend repo (or subdirectory) to run verification in. */
  cwd: string;
  /** From `.blastradius.yml`'s `testCommand`, if configured. */
  testCommand?: string;
  /** Optional Storybook build command, if configured. */
  storybookBuildCommand?: string;
}

interface StepResult {
  ok: boolean;
  output: string;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<StepResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { cwd });
    return { ok: true, output: [stdout, stderr].filter(Boolean).join("\n") };
  } catch (error) {
    const stdout = error && typeof error === "object" && "stdout" in error ? String((error as { stdout: unknown }).stdout) : "";
    const stderr = error && typeof error === "object" && "stderr" in error ? String((error as { stderr: unknown }).stderr) : String(error);
    return { ok: false, output: [stdout, stderr].filter(Boolean).join("\n") };
  }
}

function splitCommand(command: string): [string, string[]] {
  const [cmd, ...args] = command.split(/\s+/).filter(Boolean);
  return [cmd!, args];
}

/** Runs `tsc --noEmit`, then the configured test command, then the configured Storybook build, stopping at the first failure. */
export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  const localTsc = path.join(options.cwd, "node_modules", ".bin", "tsc");
  const tscCommand = existsSync(localTsc) ? localTsc : "tsc";

  const steps: Array<{ label: string; command: string; args: string[] }> = [{ label: "tsc --noEmit", command: tscCommand, args: ["--noEmit"] }];
  if (options.testCommand) {
    const [cmd, args] = splitCommand(options.testCommand);
    steps.push({ label: `test (${options.testCommand})`, command: cmd, args });
  }
  if (options.storybookBuildCommand) {
    const [cmd, args] = splitCommand(options.storybookBuildCommand);
    steps.push({ label: `storybook build (${options.storybookBuildCommand})`, command: cmd, args });
  }

  const outputs: string[] = [];
  for (const step of steps) {
    const result = await runCommand(step.command, step.args, options.cwd);
    outputs.push(`--- ${step.label} ---\n${result.output}`);
    if (!result.ok) {
      return { status: "fail", output: outputs.join("\n\n") };
    }
  }

  return { status: "pass", output: outputs.join("\n\n") };
}
