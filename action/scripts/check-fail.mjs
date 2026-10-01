#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { shouldFail } from "../src/checkFail.mjs";

const jsonPath = process.argv[2];
const failOn = process.argv[3];
if (!jsonPath || !failOn) {
  console.error("Usage: check-fail.mjs <path-to-report.json> <breaking|never>");
  process.exit(1);
}

const report = JSON.parse(readFileSync(jsonPath, "utf8"));

if (shouldFail(report.summary, failOn)) {
  console.error(`${report.summary.breakingChanges} breaking change(s) found and failOn=${failOn} -- failing.`);
  process.exit(1);
}
console.log(`OK (failOn=${failOn}, breakingChanges=${report.summary.breakingChanges}).`);
