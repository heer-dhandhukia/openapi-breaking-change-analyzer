#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { runAnalyze } from "./analyze.js";

export { runAnalyze } from "./analyze.js";
export type { AnalyzeOptions, AnalyzeResult } from "./analyze.js";

const USAGE = "Usage: blast analyze --base <spec> --head <spec> --frontend <dir>[,<dir>] [--json out.json] [--md out.md]";

export async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      base: { type: "string" },
      head: { type: "string" },
      frontend: { type: "string" },
      json: { type: "string" },
      md: { type: "string" },
    },
  });

  const command = positionals[0];
  if (command !== "analyze") {
    console.error(`Unknown command: ${command ?? "(none)"}\n${USAGE}`);
    return 1;
  }

  const { base, head, frontend, json, md } = values;
  if (!base || !head || !frontend) {
    console.error(USAGE);
    return 1;
  }

  const frontendDirs = frontend
    .split(",")
    .map((dir) => dir.trim())
    .filter(Boolean);

  const result = await runAnalyze({ base, head, frontendDirs });

  if (json) {
    await writeFile(json, JSON.stringify(result.json, null, 2) + "\n", "utf8");
  }
  if (md) {
    await writeFile(md, result.markdown, "utf8");
  }
  if (!json && !md) {
    console.log(result.markdown);
  }

  // Exit-code policy (e.g. failing CI on breaking changes) is the GitHub Action's
  // `failOn` concern (Phase 3), not this command's -- `analyze` just reports.
  return 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    });
}
