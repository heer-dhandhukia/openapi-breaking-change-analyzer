import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { beforeAll, describe, expect, it } from "vitest";
import { diffSpecs } from "@blast/spec-diff";
import { buildFeIndex, type FeIndex } from "@blast/fe-index";
import { matchImpacts } from "@blast/impact";
import { buildMarkdownReport } from "./markdown.js";
import { buildJsonReport } from "./json.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const specsDir = path.join(repoRoot, "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const frontendDir = path.join(repoRoot, "fixtures", "demo-frontend");
const tsConfigFilePath = path.join(frontendDir, "tsconfig.json");
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

describe("buildMarkdownReport golden files (one per ChangeKind fixture)", () => {
  for (const kind of kinds) {
    it(`${kind} matches its golden markdown`, async () => {
      const { impacts, unmatched } = await runKind(kind);
      const markdown = buildMarkdownReport(impacts, unmatched, [], { rootDir: frontendDir });
      const golden = readFileSync(path.join(goldenDir, `${kind}.md`), "utf8");
      expect(markdown).toBe(golden);
    });
  }
});

describe("buildMarkdownReport structure", () => {
  it("keeps a typical report collapsed to well under ~60 visible lines (everything but the summary line and <summary> tags is inside <details>)", async () => {
    const { impacts, unmatched } = await runKind("response-field-type-changed");
    const markdown = buildMarkdownReport(impacts, unmatched, [], { rootDir: frontendDir });
    const lines = markdown.split("\n");
    const visibleLines = lines.filter((line) => !isInsideCollapsedDetails(lines, line));
    expect(visibleLines.length).toBeLessThan(20);
  });

  it("reports zero breaking changes and marks the section non-breaking for enum-value-removed", async () => {
    const { impacts, unmatched } = await runKind("enum-value-removed");
    const markdown = buildMarkdownReport(impacts, unmatched, [], { rootDir: frontendDir });
    expect(markdown).toContain("**0** breaking changes");
    expect(markdown).toContain("⚪ non-breaking");
  });

  it("renders nothing for a diff with no changes", async () => {
    const markdown = buildMarkdownReport([], [], [], { rootDir: frontendDir });
    expect(markdown).toContain("**0** breaking change");
    expect(markdown).toContain("No changes detected.");
  });
});

// crude but sufficient: everything between a `<details>` and its matching `</details>` is
// collapsed by default and not "visible" in a rendered PR comment.
function isInsideCollapsedDetails(allLines: string[], line: string): boolean {
  const idx = allLines.indexOf(line);
  let depth = 0;
  for (let i = 0; i <= idx; i++) {
    if (allLines[i] === "<details>") depth++;
    if (allLines[i] === "</details>") depth--;
  }
  return depth > 0 && line !== "<details>";
}

describe("buildJsonReport", () => {
  it("mirrors the same summary, impacts, and unmatched data", async () => {
    const { impacts, unmatched } = await runKind("endpoint-removed");
    const json = buildJsonReport(impacts, unmatched);
    expect(json.summary).toEqual({ breakingChanges: 1, filesAffected: 2, storiesAffected: 0 });
    expect(json.impacts).toEqual(impacts);
    expect(json.unmatched).toEqual(unmatched);
  });
});
