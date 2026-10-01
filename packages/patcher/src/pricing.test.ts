import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing.js";

describe("estimateCostUsd", () => {
  it("computes claude-sonnet-5 cost from its per-million-token rate", () => {
    // $3.00/1M input, $15.00/1M output
    const cost = estimateCostUsd("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(18.0, 6);
  });

  it("scales linearly with token count", () => {
    const cost = estimateCostUsd("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 100_000 });
    expect(cost).toBeCloseTo(0.5 * 3.0 + 0.1 * 15.0, 6);
  });

  it("falls back to claude-sonnet-5 pricing for an unrecognized model rather than throwing", () => {
    const known = estimateCostUsd("claude-sonnet-5", { inputTokens: 1000, outputTokens: 1000 });
    const unknown = estimateCostUsd("some-future-model", { inputTokens: 1000, outputTokens: 1000 });
    expect(unknown).toBe(known);
  });
});
