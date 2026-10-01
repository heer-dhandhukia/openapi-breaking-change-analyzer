import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { cpSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPatch } from "diff";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Impact } from "@blast/impact";
import { MockLlmClient } from "./mockLlmClient.js";
import { runPatchForFile, runPatcher } from "./patcher.js";

// Real git operations and a real `tsc --noEmit` run against a throwaway copy of
// fixtures/demo-frontend, with only the LLM mocked -- see DECISIONS.md and action/README.md
// for the same "test everything except the part that needs a live external system" pattern
// used in Phases 3 and 4.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const realFrontend = path.join(repoRoot, "fixtures", "demo-frontend");

let tmpDir: string;

function git(args: string[], cwd = tmpDir) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "blast-patcher-"));
  cpSync(realFrontend, tmpDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}dist`),
  });
  // Reuse the real fixture's already-installed deps instead of reinstalling per test.
  symlinkSync(path.join(realFrontend, "node_modules"), path.join(tmpDir, "node_modules"));

  // Simulate the actual backend change these tests are about: `role` removed from `User`.
  // Without this, `user.role` in UsersTable.tsx would still type-check against the
  // fixture's unmodified `User` interface, and `tsc --noEmit` would never fail in the
  // first place -- these tests would "pass" without exercising anything real.
  const typesPath = path.join(tmpDir, "src/types.ts");
  writeFileSync(typesPath, readFileSync(typesPath, "utf8").replace("  role: string;\n", ""));

  // UserCard.stories.tsx also hardcodes a `role` field in a User object literal. Fixing
  // Storybook stories is out of scope for the patcher (Impact.stories is tracked
  // separately from Impact.sites, and nothing routes a fix there) -- neutralize it here so
  // these tests isolate UsersTable.tsx's own compile error, the one thing being tested,
  // rather than tripping over this unrelated fixture-wide fallout from the same field
  // removal.
  const storyPath = path.join(tmpDir, "stories/UserCard.stories.tsx");
  writeFileSync(storyPath, readFileSync(storyPath, "utf8").replace(', role: "admin"', ""));

  git(["init", "-q"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Blast Test"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "initial"]);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function usersTableImpact(file: string): Impact {
  return {
    change: {
      kind: "response-field-removed",
      operationId: "getUsers",
      method: "GET",
      path: "/users",
      fieldPath: "response.200.users[].role",
      breaking: true,
      detail: "removed the required property `users/items/role` from the response with the `200` status",
    },
    confidence: "exact",
    endpoint: { name: "getUsers", file: path.join(tmpDir, "src/api/generatedApi.ts"), line: 15 },
    sites: [{ file, line: 12, column: 12, kind: "field-access", symbol: "data.users[].role" }],
    stories: [],
  };
}

describe("runPatchForFile", () => {
  it("verified: a correct mocked diff applies, tsc passes, and the change is committed", async () => {
    const targetFile = path.join(tmpDir, "src/components/UsersTable.tsx");
    const before = readFileSync(targetFile, "utf8");
    const after = before.replace("            <td>{user.role}</td>\n", "");
    expect(after).not.toBe(before); // sanity check the fixture still has the line we expect

    const diffText = createPatch("src/components/UsersTable.tsx", before, after);

    // Confirm the premise: unpatched, tsc genuinely fails (role no longer exists on User) --
    // otherwise this test would "pass" without the fix actually doing anything.
    expect(() => execFileSync(path.join(tmpDir, "node_modules/.bin/tsc"), ["--noEmit"], { cwd: tmpDir, encoding: "utf8" })).toThrow();

    const llmClient = new MockLlmClient([{ diff: diffText, usage: { inputTokens: 500, outputTokens: 120 } }]);

    const result = await runPatchForFile({
      cwd: tmpDir,
      file: targetFile,
      impacts: [usersTableImpact(targetFile)],
      llmClient,
      model: "claude-sonnet-5",
    });

    expect(result.outcome).toBe("verified");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.verify.status).toBe("pass");
    expect(result.usage).toEqual({ inputTokens: 500, outputTokens: 120 });
    expect(result.costUsd).toBeGreaterThan(0);
    expect(readFileSync(targetFile, "utf8")).toBe(after);

    // Committed to the current branch, not left as an uncommitted working-tree change.
    const status = git(["status", "--porcelain"]);
    expect(status.trim()).toBe("");
    const log = git(["log", "-1", "--pretty=%s"]);
    expect(log).toContain("UsersTable.tsx");
  }, 30_000);

  it("needs-human: a diff that never applies exhausts all 3 attempts and leaves the file untouched", async () => {
    const targetFile = path.join(tmpDir, "src/components/UsersTable.tsx");
    const before = readFileSync(targetFile, "utf8");

    const badDiff = createPatch("src/components/UsersTable.tsx", "content that does not exist in the real file\nat all\n", "content that does not exist in the real file\nmodified\n");
    const llmClient = new MockLlmClient([{ diff: badDiff, usage: { inputTokens: 400, outputTokens: 80 } }]);

    const result = await runPatchForFile({
      cwd: tmpDir,
      file: targetFile,
      impacts: [usersTableImpact(targetFile)],
      llmClient,
      model: "claude-sonnet-5",
    });

    expect(result.outcome).toBe("needs-human");
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts.every((attempt) => attempt.verify.status === "fail")).toBe(true);
    expect(llmClient.callCount).toBe(3); // retried with error output twice after the first failure
    expect(readFileSync(targetFile, "utf8")).toBe(before); // failed attempts always get discarded

    const status = git(["status", "--porcelain"]);
    expect(status.trim()).toBe("");
  }, 30_000);

  it("needs-human: a diff that applies but doesn't fix the type error also exhausts retries", async () => {
    const targetFile = path.join(tmpDir, "src/components/UsersTable.tsx");
    const before = readFileSync(targetFile, "utf8");
    // Applies cleanly (valid diff, matching context) but doesn't touch the now-invalid
    // `user.role` read -- tsc should still fail.
    const after = before.replace("useGetUsersQuery()", "useGetUsersQuery() // reviewed");
    const noopDiff = createPatch("src/components/UsersTable.tsx", before, after);
    const llmClient = new MockLlmClient([{ diff: noopDiff, usage: { inputTokens: 300, outputTokens: 60 } }]);

    const result = await runPatchForFile({
      cwd: tmpDir,
      file: targetFile,
      impacts: [usersTableImpact(targetFile)],
      llmClient,
      model: "claude-sonnet-5",
    });

    expect(result.outcome).toBe("needs-human");
    expect(result.attempts.every((attempt) => attempt.verify.output.includes("role"))).toBe(true);
  }, 30_000);
});

describe("runPatcher", () => {
  it("does not open a PR when a file needs-human, even with openPr:true", async () => {
    const targetFile = path.join(tmpDir, "src/components/UsersTable.tsx");
    const badDiff = createPatch("src/components/UsersTable.tsx", "nonexistent\n", "nonexistent modified\n");
    const llmClient = new MockLlmClient([{ diff: badDiff, usage: { inputTokens: 100, outputTokens: 20 } }]);

    let execCalled = false;
    const result = await runPatcher({
      cwd: tmpDir,
      impacts: [usersTableImpact(targetFile)],
      llmClient,
      openPr: true,
      execForPr: async () => {
        execCalled = true;
        return { stdout: "", stderr: "" };
      },
    });

    expect(result.fileResults.every((r) => r.outcome === "needs-human")).toBe(true);
    expect(result.prUrl).toBeUndefined();
    expect(execCalled).toBe(false);
  }, 30_000);

  it("opens a PR (via the injected exec) once every file verifies", async () => {
    const targetFile = path.join(tmpDir, "src/components/UsersTable.tsx");
    const before = readFileSync(targetFile, "utf8");
    const after = before.replace("            <td>{user.role}</td>\n", "");
    const diffText = createPatch("src/components/UsersTable.tsx", before, after);
    const llmClient = new MockLlmClient([{ diff: diffText, usage: { inputTokens: 500, outputTokens: 120 } }]);

    const calls: string[] = [];
    const result = await runPatcher({
      cwd: tmpDir,
      impacts: [usersTableImpact(targetFile)],
      llmClient,
      openPr: true,
      baseBranch: "main",
      execForPr: async (command, args) => {
        calls.push(`${command} ${args.join(" ")}`);
        if (command === "gh") return { stdout: "https://github.com/x/y/pull/1\n", stderr: "" };
        return { stdout: "", stderr: "" };
      },
    });

    expect(result.fileResults.every((r) => r.outcome === "verified")).toBe(true);
    expect(result.prUrl).toBe("https://github.com/x/y/pull/1");
    expect(calls[0]).toMatch(/^git push -u origin /);
    expect(calls[1]).toMatch(/^gh pr create --draft --base main/);
  }, 30_000);
});
