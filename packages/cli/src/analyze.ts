import path from "node:path";
import { Project } from "ts-morph";
import { diffSpecs } from "@blast/spec-diff";
import { buildFeIndex, type FeIndex } from "@blast/fe-index";
import { matchImpacts } from "@blast/impact";
import { buildJsonReport, buildMarkdownReport, type JsonReport } from "@blast/report";

export interface AnalyzeOptions {
  base: string;
  head: string;
  /** One or more frontend repo/package roots, each expected to have its own tsconfig.json. */
  frontendDirs: string[];
  /** oasdiff binary override, mainly for tests. See @blast/spec-diff. */
  oasdiffBinPath?: string;
}

export interface AnalyzeResult {
  json: JsonReport;
  markdown: string;
}

function buildCombinedFeIndex(frontendDirs: string[]): FeIndex {
  const endpoints = frontendDirs.flatMap((dir) => {
    const tsConfigFilePath = path.join(dir, "tsconfig.json");
    const project = new Project({ tsConfigFilePath });
    return buildFeIndex(project).endpoints;
  });
  return { endpoints };
}

export async function runAnalyze(options: AnalyzeOptions): Promise<AnalyzeResult> {
  const feIndex = buildCombinedFeIndex(options.frontendDirs);
  const { changes, unmapped } = await diffSpecs(options.base, options.head, options.oasdiffBinPath ? { binPath: options.oasdiffBinPath } : {});
  const { impacts, unmatched } = matchImpacts(changes, feIndex);

  const json = buildJsonReport(impacts, unmatched, unmapped);
  // With multiple frontend dirs there's no single common root -- relativize against the
  // first one as a readability best-effort; paths outside it just render with leading `..`.
  const rootDir = options.frontendDirs[0];
  const markdown = buildMarkdownReport(impacts, unmatched, unmapped, rootDir ? { rootDir } : {});

  return { json, markdown };
}
