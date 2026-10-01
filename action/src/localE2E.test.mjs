// Simulates the composite action's logic end to end WITHOUT real GitHub infrastructure:
// fixtures/demo-frontend stands in for "a repo checkout-frontends.mjs already cloned", and
// fixtures/specs' v1.yaml/head-*.yaml stand in for "the base and head spec git show would
// extract". This exercises everything the action does except the actual `git clone` and
// `gh api` calls (those two are thin, untestable-without-live-GitHub wrappers around the
// sticky-comment/checkout-plan logic that IS covered, in stickyComment.test.mjs and
// checkoutPlan.test.mjs). See action/README.md's "Testing status" section.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseBlastConfig } from "./config.mjs";
import { shouldFail } from "./checkFail.mjs";
import { findStickyCommentId, withMarker } from "./stickyComment.mjs";

const execFileAsync = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const frontendDir = path.join(repoRoot, "fixtures", "demo-frontend");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");

const SAMPLE_CONFIG = `
spec: fixtures/specs/v1.yaml
frontends:
  - repo: myorg/demo-frontend
    ref: main
failOn: breaking
`;

describe("action pipeline simulation (config -> analyze -> fail-check -> comment decision)", () => {
  it("end to end: a breaking change parses, analyzes, and correctly decides to fail + comment", async () => {
    const config = parseBlastConfig(SAMPLE_CONFIG);
    expect(config.frontends).toHaveLength(1);

    // Stand-in for checkout-frontends.mjs's output: point straight at the real fixture dir.
    const { stdout } = await execFileAsync("node", [
      cliEntry,
      "analyze",
      "--base",
      path.join(specsDir, "v1.yaml"),
      "--head",
      path.join(specsDir, "head-endpoint-removed.yaml"),
      "--frontend",
      frontendDir,
    ]);

    expect(stdout).toContain("## API Blast Radius");
    expect(stdout).toContain("getPost");

    // check-fail.mjs's logic: a real endpoint-removed report has breakingChanges: 1.
    const summaryMatch = /\*\*(\d+)\*\* breaking change/.exec(stdout);
    const breakingChanges = Number(summaryMatch?.[1]);
    expect(breakingChanges).toBe(1);
    expect(shouldFail({ breakingChanges }, config.failOn)).toBe(true);

    // post-sticky-comment.mjs's decision logic: first run creates, re-run updates the same one.
    const commentBody = withMarker(stdout);
    const noExistingComments = [];
    expect(findStickyCommentId(noExistingComments)).toBeUndefined(); // -> would create

    const existingComments = [{ id: 42, body: commentBody }];
    expect(findStickyCommentId(existingComments)).toBe(42); // -> would update, not duplicate
  });

  it("end to end: a non-breaking change with failOn=breaking does not trigger a failure", async () => {
    const config = parseBlastConfig(SAMPLE_CONFIG);
    const { stdout } = await execFileAsync("node", [
      cliEntry,
      "analyze",
      "--base",
      path.join(specsDir, "v1.yaml"),
      "--head",
      path.join(specsDir, "head-enum-value-removed.yaml"),
      "--frontend",
      frontendDir,
    ]);

    const summaryMatch = /\*\*(\d+)\*\* breaking change/.exec(stdout);
    const breakingChanges = Number(summaryMatch?.[1]);
    expect(breakingChanges).toBe(0);
    expect(shouldFail({ breakingChanges }, config.failOn)).toBe(false);
  });

  it("respects failOn: never even with breaking changes present", () => {
    const config = parseBlastConfig(SAMPLE_CONFIG.replace("failOn: breaking", "failOn: never"));
    expect(shouldFail({ breakingChanges: 5 }, config.failOn)).toBe(false);
  });
});
