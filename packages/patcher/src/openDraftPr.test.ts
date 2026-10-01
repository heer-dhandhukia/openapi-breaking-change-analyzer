import { describe, expect, it } from "vitest";
import { pushAndOpenDraftPr } from "./openDraftPr.js";

describe("pushAndOpenDraftPr", () => {
  it("pushes the branch then creates a draft PR with the right git/gh commands -- via an injected exec, no real push or GitHub call", async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const fakeExec = async (command: string, args: string[], options: { cwd: string }) => {
      calls.push({ command, args, cwd: options.cwd });
      if (command === "gh") {
        return { stdout: "https://github.com/myorg/frontend/pull/42\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const prUrl = await pushAndOpenDraftPr(
      { cwd: "/repo/frontend", branch: "blast/api-fix-123", baseBranch: "main", title: "blast: fix frontend for backend API changes", body: "body text" },
      fakeExec,
    );

    expect(prUrl).toBe("https://github.com/myorg/frontend/pull/42");
    expect(calls).toEqual([
      { command: "git", args: ["push", "-u", "origin", "blast/api-fix-123"], cwd: "/repo/frontend" },
      { command: "gh", args: ["pr", "create", "--draft", "--base", "main", "--head", "blast/api-fix-123", "--title", "blast: fix frontend for backend API changes", "--body", "body text"], cwd: "/repo/frontend" },
    ]);
  });

  it("never pushes to the base branch -- always pushes the scratch branch by name", async () => {
    const pushedRefs: string[] = [];
    const fakeExec = async (command: string, args: string[]) => {
      if (command === "git" && args[0] === "push") {
        pushedRefs.push(args[args.length - 1]!);
      }
      return { stdout: "", stderr: "" };
    };
    await pushAndOpenDraftPr({ cwd: "/repo", branch: "blast/api-fix-456", baseBranch: "main", title: "t", body: "b" }, fakeExec);
    expect(pushedRefs).toEqual(["blast/api-fix-456"]);
    expect(pushedRefs).not.toContain("main");
  });
});
