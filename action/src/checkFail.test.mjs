import { describe, expect, it } from "vitest";
import { shouldFail } from "./checkFail.mjs";

describe("shouldFail", () => {
  it("fails when failOn=breaking and there's at least one breaking change", () => {
    expect(shouldFail({ breakingChanges: 1 }, "breaking")).toBe(true);
    expect(shouldFail({ breakingChanges: 3 }, "breaking")).toBe(true);
  });

  it("does not fail when failOn=breaking and there are zero breaking changes", () => {
    expect(shouldFail({ breakingChanges: 0 }, "breaking")).toBe(false);
  });

  it("never fails when failOn=never, regardless of breaking count", () => {
    expect(shouldFail({ breakingChanges: 5 }, "never")).toBe(false);
    expect(shouldFail({ breakingChanges: 0 }, "never")).toBe(false);
  });
});
