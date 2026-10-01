import type { Impact, SpecChange } from "@blast/impact";
import type { RawOasdiffChange } from "@blast/spec-diff";
import { computeSummary, type ReportSummary } from "./summary.js";

export interface JsonReport {
  summary: ReportSummary;
  impacts: Impact[];
  /** Changes we understood but couldn't tie to any known frontend endpoint. */
  unmatched: SpecChange[];
  /** oasdiff findings we don't have a ChangeKind mapping for at all -- see spec-diff's DECISIONS.md entry. Never dropped. */
  unrecognized: RawOasdiffChange[];
}

export function buildJsonReport(impacts: Impact[], unmatched: SpecChange[], unrecognized: RawOasdiffChange[] = []): JsonReport {
  return { summary: computeSummary(impacts, unmatched), impacts, unmatched, unrecognized };
}
