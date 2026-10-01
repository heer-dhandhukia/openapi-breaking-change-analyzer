import { Project } from "ts-morph";
import { discoverEndpoints } from "./endpoints.js";
import { findUsageSites } from "./usageSites.js";
import type { FeIndex } from "./types.js";

export type { EndpointDef, EndpointKind, EndpointSource, FeIndex, FeUsageSite, EndpointNode, UsageSite } from "./types.js";
export { discoverEndpoints } from "./endpoints.js";
export { templateToPathPattern } from "./paths.js";

/** Creates a ts-morph Project rooted at the given tsconfig.json. */
export function createProjectForTsConfig(tsConfigFilePath: string): Project {
  return new Project({ tsConfigFilePath });
}

export function buildFeIndex(project: Project): FeIndex {
  const endpoints = discoverEndpoints(project);
  const { sitesByEndpoint, storiesByEndpoint } = findUsageSites(project, endpoints);

  return {
    endpoints: endpoints.map((endpoint) => ({
      endpoint,
      sites: sitesByEndpoint.get(endpoint) ?? [],
      stories: Array.from(storiesByEndpoint.get(endpoint) ?? []),
    })),
  };
}
