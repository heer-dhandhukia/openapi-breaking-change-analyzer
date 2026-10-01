#!/usr/bin/env node
// Clones each frontend repo at its configured ref (shallow, since we only need the current
// tree to index it) and runs its codegen command if one was given. Reads the config JSON
// parse-config.mjs already wrote; writes the comma-joined list of directories `blast
// analyze --frontend` should use.
import { readFileSync, appendFileSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { buildCheckoutPlan } from "../src/checkoutPlan.mjs";

const CONFIG_JSON_PATH = "/tmp/blast-config.json";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is required to check out frontend repos");
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG_JSON_PATH, "utf8"));
const plan = buildCheckoutPlan(config.frontends);

for (const frontend of plan) {
  console.log(`Checking out ${frontend.repo}@${frontend.ref} -> ${frontend.checkoutDir}`);
  execFileSync("git", ["clone", "--branch", frontend.ref, "--depth", "1", `https://x-access-token:${token}@github.com/${frontend.repo}.git`, frontend.checkoutDir], {
    stdio: "inherit",
  });
  if (frontend.codegen) {
    console.log(`Running codegen in ${frontend.checkoutDir}: ${frontend.codegen}`);
    execSync(frontend.codegen, { cwd: frontend.checkoutDir, stdio: "inherit" });
  }
}

const dirs = plan.map((frontend) => frontend.analyzeDir).join(",");
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  appendFileSync(githubOutput, `frontend-dirs=${dirs}\n`);
}
console.log(`frontend-dirs=${dirs}`);
