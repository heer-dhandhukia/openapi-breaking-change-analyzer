import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "test/**/*.test.ts", "action/src/**/*.test.mjs", "evals/src/**/*.test.ts"],
    passWithNoTests: true,
    // Several suites spawn real `node` subprocesses that each build a fresh ts-morph
    // Project (cli.test.ts, localE2E.test.mjs) -- under parallel load the default 5s can
    // flake even though nothing's actually hung.
    testTimeout: 15_000,
    env: {
      // oasdiff isn't installed globally in this sandbox (no brew/go) -- vendored binary,
      // see DECISIONS.md. A real dev machine / CI can rely on oasdiff being on PATH
      // instead; this env var is just an override the client checks first.
      OASDIFF_BIN: process.env.OASDIFF_BIN ?? path.join(here, ".tools", "oasdiff"),
    },
  },
});
