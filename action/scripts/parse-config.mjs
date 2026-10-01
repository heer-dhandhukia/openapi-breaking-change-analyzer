#!/usr/bin/env node
// Reads and validates .blastradius.yml, writes the parsed config to a fixed temp path for
// later steps to consume, and sets the couple of simple GITHUB_OUTPUT values steps need as
// plain strings (complex nested data goes through the JSON file instead -- GITHUB_OUTPUT
// string escaping for arrays/objects isn't worth fighting).
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { parseBlastConfig } from "../src/config.mjs";

const CONFIG_JSON_PATH = "/tmp/blast-config.json";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: parse-config.mjs <path-to-.blastradius.yml>");
  process.exit(1);
}

const config = parseBlastConfig(readFileSync(configPath, "utf8"));
writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2));

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  appendFileSync(githubOutput, `spec=${config.spec}\n`);
  appendFileSync(githubOutput, `fail-on=${config.failOn}\n`);
}

console.log(`Parsed ${configPath}: spec=${config.spec}, ${config.frontends.length} frontend(s), failOn=${config.failOn}`);
