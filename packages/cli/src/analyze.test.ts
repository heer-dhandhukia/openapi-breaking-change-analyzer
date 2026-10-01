import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAnalyze } from "./analyze.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const frontendDir = path.join(repoRoot, "fixtures", "demo-frontend");

describe("runAnalyze (programmatic, single frontend dir)", () => {
  it("wires spec-diff -> fe-index -> impact -> report end to end", async () => {
    const result = await runAnalyze({
      base: v1,
      head: path.join(specsDir, "head-endpoint-removed.yaml"),
      frontendDirs: [frontendDir],
    });

    expect(result.json.summary).toEqual({ breakingChanges: 1, filesAffected: 2, storiesAffected: 0 });
    expect(result.json.impacts).toHaveLength(1);
    expect(result.json.impacts[0]?.endpoint.name).toBe("getPost");
    expect(result.json.unmatched).toEqual([]);
    expect(result.json.unrecognized).toEqual([]);
    expect(result.markdown).toContain("## API Blast Radius");
    expect(result.markdown).toContain("getPost");
  });

  it("reports no impact for a diff with no changes", async () => {
    const result = await runAnalyze({ base: v1, head: v1, frontendDirs: [frontendDir] });
    expect(result.json.summary).toEqual({ breakingChanges: 0, filesAffected: 0, storiesAffected: 0 });
    expect(result.json.impacts).toEqual([]);
    expect(result.markdown).toContain("No changes detected.");
  });
});

describe("runAnalyze (multiple --frontend dirs)", () => {
  it("merges endpoints from every frontend dir before matching", async () => {
    // Using the same fixture dir twice as a stand-in for a second real frontend repo --
    // this only exercises the merge path (endpoint counts double, matching still finds the
    // same impact), not cross-repo-specific behavior, since we only have one frontend
    // fixture. Good enough to prove buildCombinedFeIndex actually concatenates rather than
    // silently keeping only one dir's endpoints.
    const result = await runAnalyze({
      base: v1,
      head: path.join(specsDir, "head-endpoint-removed.yaml"),
      frontendDirs: [frontendDir, frontendDir],
    });
    // Both copies of the getPost endpoint match -> one Impact each.
    expect(result.json.impacts.filter((i) => i.endpoint.name === "getPost")).toHaveLength(2);
  });
});
