import { describe, expect, it } from "vitest";
import { precisionOf, recallOf, scoreCase, sumCounts } from "./scoring.js";
import type { ActualImpact, ExpectedImpact } from "./types.js";

describe("scoreCase", () => {
  it("counts a perfect match as all true positives, zero FP/FN", () => {
    const expected: ExpectedImpact[] = [{ endpoint: "getUsers", kind: "response-field-removed", confidence: "exact" }];
    const actual: ActualImpact[] = [{ endpoint: "getUsers", kind: "response-field-removed", confidence: "exact" }];
    const score = scoreCase("case", expected, actual, 0, 100);
    expect(score.exact).toEqual({ truePositives: 1, falsePositives: 0, falseNegatives: 0 });
    expect(score.possible).toEqual({ truePositives: 0, falsePositives: 0, falseNegatives: 0 });
  });

  it("counts a missed expected impact as a false negative", () => {
    const expected: ExpectedImpact[] = [{ endpoint: "getUsers", kind: "response-field-removed", confidence: "exact" }];
    const score = scoreCase("case", expected, [], 0, 100);
    expect(score.exact).toEqual({ truePositives: 0, falsePositives: 0, falseNegatives: 1 });
  });

  it("counts a spurious actual impact as a false positive", () => {
    const actual: ActualImpact[] = [{ endpoint: "getUsers", kind: "response-field-removed", confidence: "exact" }];
    const score = scoreCase("case", [], actual, 0, 100);
    expect(score.exact).toEqual({ truePositives: 0, falsePositives: 1, falseNegatives: 0 });
  });

  it("is strict about confidence: finding 'exact' where 'possible' was expected is neither a possible-bucket hit nor an exact-bucket hit", () => {
    const expected: ExpectedImpact[] = [{ endpoint: "listPosts", kind: "response-field-type-changed", confidence: "possible" }];
    const actual: ActualImpact[] = [{ endpoint: "listPosts", kind: "response-field-type-changed", confidence: "exact" }];
    const score = scoreCase("case", expected, actual, 0, 100);
    // Not a possible-bucket TP (actual confidence doesn't match)...
    expect(score.possible).toEqual({ truePositives: 0, falsePositives: 0, falseNegatives: 1 });
    // ...and not an exact-bucket TP either (nothing was expected at exact for this pair).
    expect(score.exact).toEqual({ truePositives: 0, falsePositives: 1, falseNegatives: 0 });
  });

  it("keeps exact and possible buckets independent for the same case", () => {
    const expected: ExpectedImpact[] = [
      { endpoint: "getPost", kind: "response-field-type-changed", confidence: "exact" },
      { endpoint: "listPosts", kind: "response-field-type-changed", confidence: "possible" },
    ];
    const actual: ActualImpact[] = [
      { endpoint: "getPost", kind: "response-field-type-changed", confidence: "exact" },
      { endpoint: "listPosts", kind: "response-field-type-changed", confidence: "possible" },
    ];
    const score = scoreCase("case", expected, actual, 0, 100);
    expect(score.exact).toEqual({ truePositives: 1, falsePositives: 0, falseNegatives: 0 });
    expect(score.possible).toEqual({ truePositives: 1, falsePositives: 0, falseNegatives: 0 });
  });
});

describe("precisionOf / recallOf", () => {
  it("defaults to 1 (not NaN/Infinity) when there's nothing to divide by", () => {
    const empty = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };
    expect(precisionOf(empty)).toBe(1);
    expect(recallOf(empty)).toBe(1);
  });

  it("computes precision and recall from a confusion matrix", () => {
    const counts = { truePositives: 3, falsePositives: 1, falseNegatives: 2 };
    expect(precisionOf(counts)).toBeCloseTo(3 / 4);
    expect(recallOf(counts)).toBeCloseTo(3 / 5);
  });
});

describe("sumCounts", () => {
  it("sums confusion matrices across cases for micro-averaging", () => {
    const sum = sumCounts([
      { truePositives: 1, falsePositives: 0, falseNegatives: 1 },
      { truePositives: 2, falsePositives: 1, falseNegatives: 0 },
    ]);
    expect(sum).toEqual({ truePositives: 3, falsePositives: 1, falseNegatives: 1 });
  });
});
