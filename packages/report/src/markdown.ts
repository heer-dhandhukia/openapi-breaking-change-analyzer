import path from "node:path";
import type { Impact, SpecChange } from "@blast/impact";
import type { RawOasdiffChange } from "@blast/spec-diff";
import { changeKey } from "./changeKey.js";
import { computeSummary } from "./summary.js";

export interface MarkdownReportOptions {
  /** If given, file paths are rendered relative to this directory instead of as-is. Display only -- doesn't affect the JSON report. */
  rootDir?: string;
}

function displayPath(file: string, rootDir: string | undefined): string {
  return rootDir ? path.relative(rootDir, file) : file;
}

function changeHeading(change: SpecChange): string {
  const opSuffix = change.operationId ? ` (${change.operationId})` : "";
  return `\`${change.kind}\`: ${change.method} ${change.path}${opSuffix}`;
}

function renderExactSection(impacts: Impact[], rootDir: string | undefined): string {
  const groups = new Map<string, { change: SpecChange; impacts: Impact[] }>();
  for (const impact of impacts) {
    const key = changeKey(impact.change);
    const group = groups.get(key);
    if (group) {
      group.impacts.push(impact);
    } else {
      groups.set(key, { change: impact.change, impacts: [impact] });
    }
  }

  const blocks: string[] = [];
  for (const { change, impacts: groupImpacts } of groups.values()) {
    const breakingBadge = change.breaking ? "🔴 breaking" : "⚪ non-breaking";
    const rows: string[] = [];
    for (const impact of groupImpacts) {
      for (const site of impact.sites) {
        rows.push(`| ${impact.endpoint.name} | ${site.kind} | \`${displayPath(site.file, rootDir)}:${site.line}\` | \`${site.symbol}\` |`);
      }
    }
    blocks.push(
      [
        `<details>`,
        `<summary>${breakingBadge} — ${changeHeading(change)}</summary>`,
        "",
        change.detail,
        "",
        "| Endpoint | Kind | File:Line | Symbol |",
        "|---|---|---|---|",
        ...rows,
        "",
        "</details>",
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

function renderPossibleSection(impacts: Impact[], rootDir: string | undefined): string {
  if (impacts.length === 0) {
    return "";
  }
  const rows: string[] = [];
  for (const impact of impacts) {
    for (const site of impact.sites) {
      rows.push(`| ${changeHeading(impact.change)} | ${impact.endpoint.name} | ${site.kind} | \`${displayPath(site.file, rootDir)}:${site.line}\` | \`${site.symbol}\` |`);
    }
  }
  return [
    "<details>",
    `<summary>Possible impacts (${impacts.length})</summary>`,
    "",
    "| Change | Endpoint | Kind | File:Line | Symbol |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "</details>",
  ].join("\n");
}

function renderUnmatchedSection(unmatched: SpecChange[]): string {
  if (unmatched.length === 0) {
    return "";
  }
  const rows = unmatched.map((change) => `| ${change.kind} | ${change.method} | ${change.path} | ${change.operationId ?? ""} | ${change.breaking ? "yes" : "no"} | ${change.detail} |`);
  return [
    "<details>",
    `<summary>Unmatched changes (${unmatched.length}) — no known frontend endpoint matched</summary>`,
    "",
    "| Kind | Method | Path | OperationId | Breaking | Detail |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "</details>",
  ].join("\n");
}

function renderUnrecognizedSection(unrecognized: RawOasdiffChange[]): string {
  if (unrecognized.length === 0) {
    return "";
  }
  const rows = unrecognized.map((change) => `| ${change.id} | ${change.operation ?? ""} | ${change.path ?? ""} | ${change.operationId ?? ""} | ${change.text} |`);
  return [
    "<details>",
    `<summary>Unrecognized oasdiff findings (${unrecognized.length}) — no ChangeKind mapping yet, see DECISIONS.md</summary>`,
    "",
    "| oasdiff id | Method | Path | OperationId | Text |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "</details>",
  ].join("\n");
}

export function buildMarkdownReport(impacts: Impact[], unmatched: SpecChange[], unrecognized: RawOasdiffChange[] = [], options: MarkdownReportOptions = {}): string {
  const summary = computeSummary(impacts, unmatched);
  const exactImpacts = impacts.filter((i) => i.confidence === "exact");
  const possibleImpacts = impacts.filter((i) => i.confidence === "possible");

  const parts = [
    "## API Blast Radius",
    "",
    `**${summary.breakingChanges}** breaking change${summary.breakingChanges === 1 ? "" : "s"} · **${summary.filesAffected}** file${summary.filesAffected === 1 ? "" : "s"} affected · **${summary.storiesAffected}** stor${summary.storiesAffected === 1 ? "y" : "ies"} affected`,
    "",
  ];

  if (exactImpacts.length > 0) {
    parts.push(renderExactSection(exactImpacts, options.rootDir), "");
  }
  const possibleSection = renderPossibleSection(possibleImpacts, options.rootDir);
  if (possibleSection) {
    parts.push(possibleSection, "");
  }
  const unmatchedSection = renderUnmatchedSection(unmatched);
  if (unmatchedSection) {
    parts.push(unmatchedSection, "");
  }
  const unrecognizedSection = renderUnrecognizedSection(unrecognized);
  if (unrecognizedSection) {
    parts.push(unrecognizedSection, "");
  }
  if (exactImpacts.length === 0 && possibleImpacts.length === 0 && unmatched.length === 0 && unrecognized.length === 0) {
    parts.push("No changes detected.", "");
  }

  return parts.join("\n").trimEnd() + "\n";
}
