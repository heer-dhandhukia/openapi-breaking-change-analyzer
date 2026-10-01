import type { Impact, SpecChange } from "@blast/impact";
import { changeKey } from "./changeKey.js";

export interface ReportSummary {
  breakingChanges: number;
  filesAffected: number;
  storiesAffected: number;
}

export function computeSummary(impacts: Impact[], unmatched: SpecChange[]): ReportSummary {
  const allChanges = new Map<string, SpecChange>();
  for (const impact of impacts) {
    allChanges.set(changeKey(impact.change), impact.change);
  }
  for (const change of unmatched) {
    allChanges.set(changeKey(change), change);
  }
  const breakingChanges = Array.from(allChanges.values()).filter((c) => c.breaking).length;

  const files = new Set<string>();
  const stories = new Set<string>();
  for (const impact of impacts) {
    for (const site of impact.sites) {
      files.add(site.file);
    }
    for (const story of impact.stories) {
      stories.add(story);
    }
  }

  return { breakingChanges, filesAffected: files.size, storiesAffected: stories.size };
}
