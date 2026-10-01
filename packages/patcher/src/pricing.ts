import type { LlmUsage } from "./types.js";

// Per-million-token USD list pricing. Confirmed current as of this writing (Sonnet 5's
// time-limited intro pricing already expired) -- see DECISIONS.md for the source and for
// what happens when BLAST_MODEL names something not in this table.
const PRICING_PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

const FALLBACK_MODEL = "claude-sonnet-5";

export function estimateCostUsd(model: string, usage: LlmUsage): number {
  const pricing = PRICING_PER_MILLION_USD[model] ?? PRICING_PER_MILLION_USD[FALLBACK_MODEL]!;
  return (usage.inputTokens / 1_000_000) * pricing.input + (usage.outputTokens / 1_000_000) * pricing.output;
}
