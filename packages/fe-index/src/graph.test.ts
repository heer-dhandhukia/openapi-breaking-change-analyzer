import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFeIndex } from "./index.js";
import type { EndpointNode, FeIndex, FeUsageSite } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tsConfigFilePath = path.join(here, "..", "..", "..", "fixtures", "demo-frontend", "tsconfig.json");

let index: FeIndex;

beforeAll(() => {
  const project = new Project({ tsConfigFilePath });
  index = buildFeIndex(project);
});

function endpoint(name: string): EndpointNode {
  const node = index.endpoints.find((n) => n.endpoint.name === name);
  if (!node) {
    throw new Error(`no endpoint named "${name}" -- found: ${index.endpoints.map((n) => n.endpoint.name).join(", ")}`);
  }
  return node;
}

function siteAt(sites: FeUsageSite[], file: string, line: number): FeUsageSite {
  const found = sites.find((s) => s.file.endsWith(file) && s.line === line);
  if (!found) {
    throw new Error(`no site at ${file}:${line}. Sites: ${JSON.stringify(sites.map((s) => `${s.file.split("/").pop()}:${s.line} ${s.kind} ${s.symbol}`), null, 2)}`);
  }
  return found;
}

// Every assertion below is anchored to a specific fixtures/MANIFEST.md entry -- see that
// file for the file:line -> case mapping this test is built from.
describe("fe-index graph for fixtures/demo-frontend", () => {
  it("discovers all 6 endpoints with correct method/path/source (MANIFEST.md: endpoint definitions)", () => {
    expect(index.endpoints).toHaveLength(6);

    expect(endpoint("getUser").endpoint).toMatchObject({ kind: "query", method: "GET", path: "/users/{id}", source: "hand-written" });
    expect(endpoint("getUser").endpoint.operationId).toBeUndefined();

    expect(endpoint("updateUser").endpoint).toMatchObject({ kind: "mutation", method: "PATCH", path: "/users/{id}", source: "hand-written" });
    expect(endpoint("listPosts").endpoint).toMatchObject({ kind: "query", method: "GET", path: "/posts", source: "hand-written" });

    expect(endpoint("getUsers").endpoint).toMatchObject({ kind: "query", method: "GET", path: "/users", source: "codegen", operationId: "getUsers" });
    expect(endpoint("getPost").endpoint).toMatchObject({ kind: "query", method: "GET", path: "/posts/{postId}", source: "codegen", operationId: "getPost" });
    expect(endpoint("createPost").endpoint).toMatchObject({ kind: "mutation", method: "POST", path: "/posts", source: "codegen", operationId: "createPost" });
  });

  it("getUser: direct hook-call and direct field reads in UserProfile.tsx (MANIFEST.md)", () => {
    const { sites } = endpoint("getUser");
    expect(siteAt(sites, "UserProfile.tsx", 7)).toMatchObject({ kind: "hook-call", symbol: "useGetUserQuery", confidence: "exact" });
    expect(siteAt(sites, "UserProfile.tsx", 15)).toMatchObject({ kind: "field-access", symbol: "data.user.name", confidence: "exact" });
    expect(siteAt(sites, "UserProfile.tsx", 16)).toMatchObject({ kind: "field-access", symbol: "data.user.email", confidence: "exact" });
  });

  it("getUser: one-level child-prop pass-through into UserCard.tsx (MANIFEST.md)", () => {
    const { sites, stories } = endpoint("getUser");
    expect(siteAt(sites, "UserProfile.tsx", 17)).toMatchObject({ kind: "field-access", symbol: "data.user", confidence: "exact" });
    expect(siteAt(sites, "UserCard.tsx", 8)).toMatchObject({ kind: "field-access", symbol: "data.user.name", confidence: "exact" });
    expect(siteAt(sites, "UserCard.tsx", 9)).toMatchObject({ kind: "field-access", symbol: "data.user.email", confidence: "exact" });
    expect(stories.some((s) => s.endsWith("UserProfile.stories.tsx"))).toBe(true);
    expect(stories.some((s) => s.endsWith("UserCard.stories.tsx"))).toBe(true);
  });

  it("getUser: custom useCurrentUser wrapper hook is 'possible', never dropped (MANIFEST.md)", () => {
    const { sites } = endpoint("getUser");
    expect(siteAt(sites, "useCurrentUser.ts", 9)).toMatchObject({ kind: "hook-call", symbol: "useGetUserQuery", confidence: "exact" });
    expect(siteAt(sites, "CurrentUserBadge.tsx", 7)).toMatchObject({ kind: "hook-call", symbol: "useCurrentUser", confidence: "possible" });
    expect(siteAt(sites, "CurrentUserBadge.tsx", 13)).toMatchObject({ kind: "field-access", symbol: "user.email", confidence: "possible" });
  });

  it("updateUser: hook-call and mutation-arg site (MANIFEST.md)", () => {
    const { sites } = endpoint("updateUser");
    expect(siteAt(sites, "UpdateUserForm.tsx", 5)).toMatchObject({ kind: "hook-call", symbol: "useUpdateUserMutation", confidence: "exact" });
    expect(siteAt(sites, "UpdateUserForm.tsx", 10)).toMatchObject({ kind: "mutation-arg", symbol: "updateUser", confidence: "exact" });
  });

  it("listPosts: object spread into PostItem is 'possible', and PostItem itself is never reached (MANIFEST.md)", () => {
    const { sites } = endpoint("listPosts");
    expect(siteAt(sites, "PostList.tsx", 7)).toMatchObject({ kind: "hook-call", symbol: "useListPostsQuery" });
    expect(siteAt(sites, "PostList.tsx", 12)).toMatchObject({ kind: "field-access", symbol: "posts[].id", confidence: "exact" });

    const spreadSites = sites.filter((s) => s.file.endsWith("PostList.tsx") && s.line === 12 && s.confidence === "possible");
    expect(spreadSites.length).toBeGreaterThan(0);
    expect(spreadSites[0]).toMatchObject({ kind: "field-access" });

    // Never traced through the spread -- PostItem must not appear anywhere in this endpoint's sites.
    expect(sites.some((s) => s.file.endsWith("PostItem.tsx"))).toBe(false);
  });

  it("getUsers: field access used by the response-field-removed/enum-value-removed fixtures (UsersTable.tsx, MANIFEST.md)", () => {
    const { sites } = endpoint("getUsers");
    expect(siteAt(sites, "UsersTable.tsx", 4)).toMatchObject({ kind: "hook-call", symbol: "useGetUsersQuery" });
    expect(siteAt(sites, "UsersTable.tsx", 12)).toMatchObject({ kind: "field-access", symbol: "data.users[].role", confidence: "exact" });
  });

  it("getPost: conditional-render field access still resolves to 'exact' (PostBadge.tsx, MANIFEST.md)", () => {
    const { sites } = endpoint("getPost");
    const publishedSite = sites.find((s) => s.file.endsWith("PostBadge.tsx") && s.line === 8 && s.symbol === "data.post.published");
    const titleSite = sites.find((s) => s.file.endsWith("PostBadge.tsx") && s.line === 8 && s.symbol === "data.post.title");
    expect(publishedSite).toMatchObject({ kind: "field-access", confidence: "exact" });
    expect(titleSite).toMatchObject({ kind: "field-access", confidence: "exact" });
  });

  it("createPost: hook-call and mutation-arg site (MANIFEST.md)", () => {
    const { sites } = endpoint("createPost");
    expect(siteAt(sites, "CreatePostForm.tsx", 5)).toMatchObject({ kind: "hook-call", symbol: "useCreatePostMutation" });
    expect(siteAt(sites, "CreatePostForm.tsx", 11)).toMatchObject({ kind: "mutation-arg", symbol: "createPost", confidence: "exact" });
  });

  it("never drops a usage site: every endpoint records its own definition", () => {
    for (const node of index.endpoints) {
      expect(node.sites.some((s) => s.kind === "endpoint-def" && s.symbol === node.endpoint.name)).toBe(true);
    }
  });
});
