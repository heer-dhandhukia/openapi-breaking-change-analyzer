import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.join(here, "..", "fixtures", "specs");

const changeKinds = [
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
];

describe("fixtures/specs", () => {
  it("contains v1.yaml plus one head spec per ChangeKind", () => {
    const files = readdirSync(specsDir).sort();
    const expected = ["v1.yaml", ...changeKinds.map((kind) => `head-${kind}.yaml`)].sort();
    expect(files).toEqual(expected);
  });

  it("every spec file is valid, parseable OpenAPI YAML", () => {
    const files = readdirSync(specsDir);
    for (const file of files) {
      const contents = readFileSync(path.join(specsDir, file), "utf8");
      const doc = parse(contents) as { openapi?: string; paths?: unknown };
      expect(doc.openapi, `${file} is missing "openapi"`).toBeTruthy();
      expect(doc.paths, `${file} is missing "paths"`).toBeTruthy();
    }
  });
});
