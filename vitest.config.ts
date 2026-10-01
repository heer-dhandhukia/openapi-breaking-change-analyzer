import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "test/**/*.test.ts"],
    passWithNoTests: true,
    env: {
      // oasdiff isn't installed globally in this sandbox (no brew/go) -- vendored binary,
      // see DECISIONS.md. A real dev machine / CI can rely on oasdiff being on PATH
      // instead; this env var is just an override the client checks first.
      OASDIFF_BIN: process.env.OASDIFF_BIN ?? path.join(here, ".tools", "oasdiff"),
    },
  },
});
