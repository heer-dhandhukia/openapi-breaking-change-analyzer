import { describe, expect, it } from "vitest";
import { buildCheckoutPlan } from "./checkoutPlan.mjs";

describe("buildCheckoutPlan", () => {
  it("assigns each frontend a distinct checkout dir and folds in an optional subpath", () => {
    const plan = buildCheckoutPlan(
      [
        { repo: "myorg/frontend-web", ref: "main", path: "apps/web" },
        { repo: "myorg/frontend-mobile", ref: "develop" },
      ],
      "/tmp/blast-frontends",
    );

    expect(plan).toEqual([
      { repo: "myorg/frontend-web", ref: "main", path: "apps/web", checkoutDir: "/tmp/blast-frontends/0-myorg_frontend-web", analyzeDir: "/tmp/blast-frontends/0-myorg_frontend-web/apps/web" },
      { repo: "myorg/frontend-mobile", ref: "develop", checkoutDir: "/tmp/blast-frontends/1-myorg_frontend-mobile", analyzeDir: "/tmp/blast-frontends/1-myorg_frontend-mobile" },
    ]);
  });

  it("sanitizes repo names that contain path separators", () => {
    const [entry] = buildCheckoutPlan([{ repo: "my-org/some.repo", ref: "main" }]);
    expect(entry.checkoutDir).toBe("/tmp/blast-frontends/0-my-org_some_repo");
  });
});
