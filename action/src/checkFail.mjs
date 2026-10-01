/**
 * @param {{ breakingChanges: number }} summary
 * @param {"breaking" | "never"} failOn
 * @returns {boolean}
 */
export function shouldFail(summary, failOn) {
  if (failOn === "never") {
    return false;
  }
  return summary.breakingChanges > 0;
}
