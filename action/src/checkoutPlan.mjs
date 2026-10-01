/**
 * Maps each `.blastradius.yml` frontend entry to a local checkout directory and the
 * effective directory `blast analyze --frontend` should be pointed at (the checkout dir
 * plus the entry's optional `path` subdirectory, for a monorepo-style frontend repo).
 *
 * @param {Array<{repo: string, ref: string, path?: string, codegen?: string}>} frontends
 * @param {string} [baseDir]
 * @returns {Array<{repo: string, ref: string, path?: string, codegen?: string, checkoutDir: string, analyzeDir: string}>}
 */
export function buildCheckoutPlan(frontends, baseDir = "/tmp/blast-frontends") {
  return frontends.map((frontend, index) => {
    const safeName = frontend.repo.replace(/[^a-zA-Z0-9_-]/g, "_");
    const checkoutDir = `${baseDir}/${index}-${safeName}`;
    const analyzeDir = frontend.path ? `${checkoutDir}/${frontend.path}` : checkoutDir;
    return { ...frontend, checkoutDir, analyzeDir };
  });
}
