import { parse } from "yaml";

const VALID_FAIL_ON = new Set(["breaking", "never"]);

/**
 * Parses and validates a `.blastradius.yml` config (already read as text). Throws with a
 * specific, actionable message on any structural problem -- this runs in CI, so a vague
 * error is a wasted debugging round-trip for whoever's PR triggered it.
 *
 * @param {string} yamlText
 * @returns {{ spec: string, frontends: Array<{repo: string, ref: string, path?: string, codegen?: string}>, failOn: "breaking" | "never", testCommand?: string }}
 */
export function parseBlastConfig(yamlText) {
  const raw = parse(yamlText);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(".blastradius.yml must be a YAML mapping");
  }
  if (typeof raw.spec !== "string" || raw.spec.length === 0) {
    throw new Error(".blastradius.yml: `spec` is required and must be a string (path to the OpenAPI spec)");
  }
  if (!Array.isArray(raw.frontends) || raw.frontends.length === 0) {
    throw new Error(".blastradius.yml: `frontends` is required and must be a non-empty array");
  }

  const frontends = raw.frontends.map((entry, i) => {
    if (!entry || typeof entry.repo !== "string" || entry.repo.length === 0) {
      throw new Error(`.blastradius.yml: frontends[${i}].repo is required (e.g. "myorg/frontend-web")`);
    }
    if (typeof entry.ref !== "string" || entry.ref.length === 0) {
      throw new Error(`.blastradius.yml: frontends[${i}].ref is required (e.g. "main")`);
    }
    if (entry.path !== undefined && typeof entry.path !== "string") {
      throw new Error(`.blastradius.yml: frontends[${i}].path must be a string if given`);
    }
    if (entry.codegen !== undefined && typeof entry.codegen !== "string") {
      throw new Error(`.blastradius.yml: frontends[${i}].codegen must be a string if given`);
    }
    return {
      repo: entry.repo,
      ref: entry.ref,
      ...(entry.path !== undefined ? { path: entry.path } : {}),
      ...(entry.codegen !== undefined ? { codegen: entry.codegen } : {}),
    };
  });

  const failOn = raw.failOn ?? "breaking";
  if (!VALID_FAIL_ON.has(failOn)) {
    throw new Error(`.blastradius.yml: failOn must be "breaking" or "never", got "${failOn}"`);
  }

  if (raw.testCommand !== undefined && typeof raw.testCommand !== "string") {
    throw new Error(".blastradius.yml: testCommand must be a string if given");
  }

  return {
    spec: raw.spec,
    frontends,
    failOn,
    ...(raw.testCommand !== undefined ? { testCommand: raw.testCommand } : {}),
  };
}
