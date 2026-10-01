import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { beforeAll, describe, expect, it } from "vitest";
import { diffSpecs } from "@blast/spec-diff";
import { buildFeIndex, type FeIndex } from "@blast/fe-index";
import { matchImpacts } from "./match.js";
import { toPortableResult } from "./testSupport.js";
import type { Impact } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const tsConfigFilePath = path.join(repoRoot, "fixtures", "demo-frontend", "tsconfig.json");
const goldenDir = path.join(here, "..", "test", "golden");

const kinds = [
  "endpoint-removed",
  "method-changed",
  "path-changed",
  "response-field-removed",
  "response-field-type-changed",
  "response-field-became-optional",
  "enum-value-removed",
  "request-field-added-required",
  "request-field-removed",
  "param-added-required",
] as const;

let feIndex: FeIndex;

beforeAll(() => {
  const project = new Project({ tsConfigFilePath });
  feIndex = buildFeIndex(project);
});

async function runKind(kind: (typeof kinds)[number]) {
  const head = path.join(specsDir, `head-${kind}.yaml`);
  const { changes } = await diffSpecs(v1, head);
  return matchImpacts(changes, feIndex);
}

function findImpact(impacts: Impact[], endpointName: string): Impact {
  const impact = impacts.find((i) => i.endpoint.name === endpointName);
  if (!impact) {
    throw new Error(`no impact for endpoint "${endpointName}" among: ${impacts.map((i) => i.endpoint.name).join(", ")}`);
  }
  return impact;
}

describe("matchImpacts against the real pipeline (fixtures/specs x fixtures/demo-frontend)", () => {
  it("endpoint-removed: getPost, exact, all its usage sites", async () => {
    const { impacts, unmatched } = await runKind("endpoint-removed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    const impact = findImpact(impacts, "getPost");
    expect(impact.confidence).toBe("exact");
    expect(impact.sites.length).toBeGreaterThanOrEqual(6); // PostBadge + PostDetail hook-calls and field-accesses
  });

  it("method-changed: updateUser, exact (matched via method+path fallback -- hand-written, no operationId)", async () => {
    const { impacts, unmatched } = await runKind("method-changed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    const impact = findImpact(impacts, "updateUser");
    expect(impact.confidence).toBe("exact");
    expect(impact.sites.map((s) => s.kind).sort()).toEqual(["hook-call", "mutation-arg"]);
  });

  it("path-changed: getPost, exact -- matched at its OLD path, not the new /full one", async () => {
    const { impacts, unmatched } = await runKind("path-changed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    expect(findImpact(impacts, "getPost").confidence).toBe("exact");
  });

  it("response-field-removed: only getUsers is impacted -- getUser/updateUser match the endpoint but never read `role`", async () => {
    const { impacts, unmatched } = await runKind("response-field-removed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    const impact = findImpact(impacts, "getUsers");
    expect(impact.confidence).toBe("exact");
    expect(impact.sites).toEqual([expect.objectContaining({ kind: "field-access", symbol: "data.users[].role" })]);
  });

  it("response-field-type-changed: listPosts via the spread (possible) and getPost directly (exact); createPost unaffected", async () => {
    const { impacts, unmatched } = await runKind("response-field-type-changed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(2);

    const listPostsImpact = findImpact(impacts, "listPosts");
    expect(listPostsImpact.confidence).toBe("possible");
    expect(listPostsImpact.sites[0]?.symbol).toBe("posts[]");

    const getPostImpact = findImpact(impacts, "getPost");
    expect(getPostImpact.confidence).toBe("exact");
    expect(getPostImpact.sites).toEqual([expect.objectContaining({ symbol: "data.post.published" })]);

    expect(impacts.some((i) => i.endpoint.name === "createPost")).toBe(false);
  });

  it("response-field-became-optional: getUser (both direct read and the pass-through into UserCard); getUsers/updateUser unaffected", async () => {
    const { impacts, unmatched } = await runKind("response-field-became-optional");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    const impact = findImpact(impacts, "getUser");
    expect(impact.confidence).toBe("exact");
    expect(impact.sites.map((s) => s.symbol).sort()).toEqual(["data.user.email", "data.user.email"]);
    expect(impact.sites.map((s) => s.file.split("/").pop()).sort()).toEqual(["UserCard.tsx", "UserProfile.tsx"]);
  });

  it("enum-value-removed: getUsers, exact, non-breaking (oasdiff's own classification is preserved on the change)", async () => {
    const { impacts, unmatched } = await runKind("enum-value-removed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    const impact = findImpact(impacts, "getUsers");
    expect(impact.confidence).toBe("exact");
    expect(impact.change.breaking).toBe(false);
  });

  it("request-field-added-required: updateUser, exact", async () => {
    const { impacts, unmatched } = await runKind("request-field-added-required");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    expect(findImpact(impacts, "updateUser").confidence).toBe("exact");
  });

  it("request-field-removed: createPost, exact", async () => {
    const { impacts, unmatched } = await runKind("request-field-removed");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    expect(findImpact(impacts, "createPost").confidence).toBe("exact");
  });

  it("param-added-required: listPosts, exact, bundles the spread site in too (identity-level change -> all usage sites)", async () => {
    const { impacts, unmatched } = await runKind("param-added-required");
    expect(unmatched).toEqual([]);
    expect(impacts).toHaveLength(1);
    const impact = findImpact(impacts, "listPosts");
    expect(impact.confidence).toBe("exact");
    expect(impact.sites.length).toBe(4);
  });

  it("never misses an exact impact: every fixture whose frontend usage is directly, unambiguously traceable produces an 'exact' impact", async () => {
    const exactByKind: Record<string, string[]> = {
      "endpoint-removed": ["getPost"],
      "method-changed": ["updateUser"],
      "path-changed": ["getPost"],
      "response-field-removed": ["getUsers"],
      "response-field-type-changed": ["getPost"],
      "response-field-became-optional": ["getUser"],
      "enum-value-removed": ["getUsers"],
      "request-field-added-required": ["updateUser"],
      "request-field-removed": ["createPost"],
      "param-added-required": ["listPosts"],
    };
    for (const [kind, expectedEndpoints] of Object.entries(exactByKind)) {
      const { impacts } = await runKind(kind as (typeof kinds)[number]);
      const exactEndpoints = impacts.filter((i) => i.confidence === "exact").map((i) => i.endpoint.name);
      for (const expected of expectedEndpoints) {
        expect(exactEndpoints, `${kind} should have an exact impact on ${expected}`).toContain(expected);
      }
    }
  });

  describe("golden files", () => {
    for (const kind of kinds) {
      it(`${kind} matches its golden file`, async () => {
        const result = await runKind(kind);
        const actual = toPortableResult(result, repoRoot);
        const golden = JSON.parse(readFileSync(path.join(goldenDir, `${kind}.json`), "utf8"));
        expect(actual).toEqual(golden);
      });
    }
  });
});
