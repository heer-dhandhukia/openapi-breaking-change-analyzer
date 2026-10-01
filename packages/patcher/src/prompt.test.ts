import { describe, expect, it } from "vitest";
import type { Impact } from "@blast/impact";
import { buildPrompt, buildRetryPrompt } from "./prompt.js";

const sampleImpact: Impact = {
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
  endpoint: { name: "getUsers", file: "/repo/src/api/generatedApi.ts", line: 15 },
  sites: [{ file: "/repo/src/components/UsersTable.tsx", line: 12, column: 12, kind: "field-access", symbol: "data.users[].role" }],
  stories: [],
};

describe("buildPrompt", () => {
  it("includes the change, the usage site, and the file content", () => {
    const prompt = buildPrompt({ file: "/repo/src/components/UsersTable.tsx", impacts: [sampleImpact], fileContent: "export function UsersTable() {}\n" });
    expect(prompt).toContain("response-field-removed");
    expect(prompt).toContain("GET /users");
    expect(prompt).toContain("response.200.users[].role");
    expect(prompt).toContain("data.users[].role");
    expect(prompt).toContain("UsersTable.tsx:12");
    expect(prompt).toContain("export function UsersTable() {}");
    expect(prompt).toContain("unified diff");
  });

  it("includes relevant types when given", () => {
    const prompt = buildPrompt({ file: "/repo/f.tsx", impacts: [sampleImpact], fileContent: "x", relevantTypes: "interface User { id: string }" });
    expect(prompt).toContain("interface User { id: string }");
  });

  it("omits the types section when not given", () => {
    const prompt = buildPrompt({ file: "/repo/f.tsx", impacts: [sampleImpact], fileContent: "x" });
    expect(prompt).not.toContain("Relevant types");
  });
});

describe("buildRetryPrompt", () => {
  it("includes the previous diff, the verify output, and the original file again", () => {
    const prompt = buildRetryPrompt({ file: "/repo/f.tsx", impacts: [sampleImpact], fileContent: "original content here" }, "--- a/f.tsx\n+++ b/f.tsx\n", { status: "fail", output: "error TS2339: Property 'role' does not exist" });
    expect(prompt).toContain("--- a/f.tsx");
    expect(prompt).toContain("error TS2339");
    expect(prompt).toContain("original content here");
  });
});
