import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const frontendDir = path.join(repoRoot, "fixtures", "demo-frontend");
const cliEntry = path.join(here, "..", "dist", "index.js");

let workDir: string;

beforeAll(async () => {
  // Real subprocess tests of the built CLI, per Phase 2's "at least one true subprocess
  // invocation" requirement -- everything else uses runAnalyze() directly for speed.
  await execFileAsync("node", ["-e", "1"]); // sanity: node itself is on PATH
});

afterEach(async () => {
  if (workDir) {
    await rm(workDir, { recursive: true, force: true });
  }
});

describe("blast analyze (subprocess)", () => {
  it("prints the markdown report to stdout when no --json/--md is given", async () => {
    const { stdout } = await execFileAsync("node", [cliEntry, "analyze", "--base", v1, "--head", path.join(specsDir, "head-method-changed.yaml"), "--frontend", frontendDir]);
    expect(stdout).toContain("## API Blast Radius");
    expect(stdout).toContain("updateUser");
  });

  it("writes --json and --md files", async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "blast-cli-"));
    const jsonPath = path.join(workDir, "out.json");
    const mdPath = path.join(workDir, "out.md");

    await execFileAsync("node", [cliEntry, "analyze", "--base", v1, "--head", path.join(specsDir, "head-request-field-removed.yaml"), "--frontend", frontendDir, "--json", jsonPath, "--md", mdPath]);

    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    expect(json.summary.breakingChanges).toBe(1);
    expect(json.impacts[0]?.endpoint.name).toBe("createPost");

    const markdown = await readFile(mdPath, "utf8");
    expect(markdown).toContain("createPost");
  });

  it("exits non-zero with a usage message when required args are missing", async () => {
    await expect(execFileAsync("node", [cliEntry, "analyze", "--base", v1])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Usage: blast analyze"),
    });
  });

  it("exits non-zero on an unknown subcommand", async () => {
    await expect(execFileAsync("node", [cliEntry, "frobnicate"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown command: frobnicate"),
    });
  });
});
