import { describe, expect, it } from "vitest";
import type { Impact } from "@blast/impact";
import { groupExactImpactsByFile } from "./groupByFile.js";

function makeImpact(overrides: Partial<Impact>): Impact {
  return {
    change: { kind: "response-field-removed", method: "GET", path: "/users", breaking: true, detail: "d" },
    confidence: "exact",
    endpoint: { name: "getUsers", file: "/repo/api.ts", line: 1 },
    sites: [{ file: "/repo/UsersTable.tsx", line: 5, column: 0, kind: "field-access", symbol: "data.role" }],
    stories: [],
    ...overrides,
  };
}

describe("groupExactImpactsByFile", () => {
  it("groups by usage-site file, skipping 'possible' impacts entirely", () => {
    const exact = makeImpact({});
    const possible = makeImpact({ confidence: "possible", sites: [{ file: "/repo/Other.tsx", line: 1, column: 0, kind: "field-access", symbol: "x" }] });
    const groups = groupExactImpactsByFile([exact, possible]);
    expect([...groups.keys()]).toEqual(["/repo/UsersTable.tsx"]);
  });

  it("skips the purely-informational endpoint-def site", () => {
    const impact = makeImpact({
      sites: [
        { file: "/repo/api.ts", line: 1, column: 0, kind: "endpoint-def", symbol: "getUsers" },
        { file: "/repo/UsersTable.tsx", line: 5, column: 0, kind: "field-access", symbol: "data.role" },
      ],
    });
    const groups = groupExactImpactsByFile([impact]);
    expect([...groups.keys()]).toEqual(["/repo/UsersTable.tsx"]);
  });

  it("also includes the endpoint definition file for a method-changed impact", () => {
    const impact = makeImpact({ change: { kind: "method-changed", method: "PATCH", path: "/users/{id}", breaking: true, detail: "d" } });
    const groups = groupExactImpactsByFile([impact]);
    expect([...groups.keys()].sort()).toEqual(["/repo/UsersTable.tsx", "/repo/api.ts"].sort());
  });

  it("does NOT include the endpoint definition file for endpoint-removed -- nothing to fix there", () => {
    const impact = makeImpact({ change: { kind: "endpoint-removed", method: "GET", path: "/users/{id}", breaking: true, detail: "d" } });
    const groups = groupExactImpactsByFile([impact]);
    expect([...groups.keys()]).toEqual(["/repo/UsersTable.tsx"]);
  });

  it("a file touched by multiple impacts gets all of them in its group, without duplicates", () => {
    const impactA = makeImpact({});
    const impactB = makeImpact({ change: { kind: "response-field-type-changed", method: "GET", path: "/users", breaking: true, detail: "d2" } });
    const groups = groupExactImpactsByFile([impactA, impactB]);
    expect(groups.get("/repo/UsersTable.tsx")).toEqual([impactA, impactB]);
  });
});
