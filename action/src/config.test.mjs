import { describe, expect, it } from "vitest";
import { parseBlastConfig } from "./config.mjs";

describe("parseBlastConfig", () => {
  it("parses a full, valid config", () => {
    const config = parseBlastConfig(`
spec: api/openapi.yaml
frontends:
  - repo: myorg/frontend-web
    ref: main
    path: apps/web
    codegen: npm run generate:api
  - repo: myorg/frontend-mobile
    ref: develop
failOn: never
testCommand: npm test
`);
    expect(config).toEqual({
      spec: "api/openapi.yaml",
      frontends: [
        { repo: "myorg/frontend-web", ref: "main", path: "apps/web", codegen: "npm run generate:api" },
        { repo: "myorg/frontend-mobile", ref: "develop" },
      ],
      failOn: "never",
      testCommand: "npm test",
    });
  });

  it("defaults failOn to 'breaking' when omitted", () => {
    const config = parseBlastConfig(`
spec: openapi.yaml
frontends:
  - repo: myorg/frontend
    ref: main
`);
    expect(config.failOn).toBe("breaking");
  });

  it("rejects a missing spec", () => {
    expect(() => parseBlastConfig(`frontends:\n  - repo: a/b\n    ref: main\n`)).toThrow(/`spec` is required/);
  });

  it("rejects an empty frontends list", () => {
    expect(() => parseBlastConfig(`spec: openapi.yaml\nfrontends: []\n`)).toThrow(/non-empty array/);
  });

  it("rejects a frontend entry missing ref", () => {
    expect(() => parseBlastConfig(`spec: openapi.yaml\nfrontends:\n  - repo: a/b\n`)).toThrow(/frontends\[0\]\.ref is required/);
  });

  it("rejects an invalid failOn value", () => {
    expect(() => parseBlastConfig(`spec: openapi.yaml\nfrontends:\n  - repo: a/b\n    ref: main\nfailOn: sometimes\n`)).toThrow(/failOn must be "breaking" or "never"/);
  });

  it("rejects a non-mapping document", () => {
    expect(() => parseBlastConfig(`- just\n- a\n- list\n`)).toThrow(/must be a YAML mapping/);
  });
});
