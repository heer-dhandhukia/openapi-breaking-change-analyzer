import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SpecChange } from "./types.js";
import { runChangelog } from "./oasdiffClient.js";
import { normalizeChanges } from "./normalize.js";
import type { RawOasdiffChange } from "./oasdiffTypes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.join(here, "..", "..", "..", "fixtures", "specs");
const v1 = path.join(specsDir, "v1.yaml");
const head = (kind: string) => path.join(specsDir, `head-${kind}.yaml`);

async function diff(kind: string) {
  const raw = await runChangelog(v1, head(kind));
  return normalizeChanges(raw);
}

function findChange(changes: SpecChange[], operationId: string): SpecChange {
  const change = changes.find((c) => c.operationId === operationId);
  if (!change) {
    throw new Error(`no change found for operationId ${operationId} in ${JSON.stringify(changes)}`);
  }
  return change;
}

describe("normalizeChanges against fixture head specs", () => {
  it("endpoint-removed", async () => {
    const { changes, unmapped } = await diff("endpoint-removed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "endpoint-removed",
      operationId: "getPost",
      method: "GET",
      path: "/posts/{postId}",
      breaking: true,
    });
  });

  it("method-changed", async () => {
    const { changes, unmapped } = await diff("method-changed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "method-changed",
      operationId: "updateUser",
      // The OLD method+path: existing frontend code still calls PATCH -- that's the
      // identity impact matching needs, not the new PUT. See DECISIONS.md.
      method: "PATCH",
      path: "/users/{id}",
      breaking: true,
    });
  });

  it("path-changed", async () => {
    const { changes, unmapped } = await diff("path-changed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "path-changed",
      operationId: "getPost",
      method: "GET",
      // The OLD path: existing frontend code still calls /posts/{postId}, not the new
      // /posts/{postId}/full. See DECISIONS.md.
      path: "/posts/{postId}",
      breaking: true,
    });
  });

  it("response-field-removed", async () => {
    const { changes, unmapped } = await diff("response-field-removed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(3);
    expect(findChange(changes, "getUsers")).toMatchObject({
      kind: "response-field-removed",
      method: "GET",
      path: "/users",
      fieldPath: "response.200.users[].role",
      breaking: true,
    });
    expect(findChange(changes, "getUserById")).toMatchObject({
      kind: "response-field-removed",
      method: "GET",
      path: "/users/{id}",
      fieldPath: "response.200.user.role",
      breaking: true,
    });
    expect(findChange(changes, "updateUser")).toMatchObject({
      kind: "response-field-removed",
      method: "PATCH",
      path: "/users/{id}",
      fieldPath: "response.200.user.role",
      breaking: true,
    });
  });

  it("response-field-type-changed", async () => {
    const { changes, unmapped } = await diff("response-field-type-changed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(3);
    expect(findChange(changes, "listPosts")).toMatchObject({
      kind: "response-field-type-changed",
      method: "GET",
      path: "/posts",
      fieldPath: "response.200.[].published",
      breaking: true,
    });
    expect(findChange(changes, "createPost")).toMatchObject({
      kind: "response-field-type-changed",
      method: "POST",
      path: "/posts",
      fieldPath: "response.201.post.published",
      breaking: true,
    });
    expect(findChange(changes, "getPost")).toMatchObject({
      kind: "response-field-type-changed",
      method: "GET",
      path: "/posts/{postId}",
      fieldPath: "response.200.post.published",
      breaking: true,
    });
  });

  it("response-field-became-optional", async () => {
    const { changes, unmapped } = await diff("response-field-became-optional");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(3);
    expect(findChange(changes, "getUsers")).toMatchObject({
      kind: "response-field-became-optional",
      fieldPath: "response.200.users[].email",
      breaking: true,
    });
    expect(findChange(changes, "getUserById")).toMatchObject({
      kind: "response-field-became-optional",
      fieldPath: "response.200.user.email",
      breaking: true,
    });
    expect(findChange(changes, "updateUser")).toMatchObject({
      kind: "response-field-became-optional",
      fieldPath: "response.200.user.email",
      breaking: true,
    });
  });

  it("enum-value-removed", async () => {
    const { changes, unmapped } = await diff("enum-value-removed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(3);
    for (const operationId of ["getUsers", "getUserById", "updateUser"]) {
      const change = findChange(changes, operationId);
      expect(change.kind).toBe("enum-value-removed");
      // Removing an enum value narrows the response -- oasdiff (correctly) does not
      // consider this breaking, and neither do we: breaking mirrors oasdiff's own level.
      expect(change.breaking).toBe(false);
    }
    expect(findChange(changes, "getUsers").fieldPath).toBe("response.200.users[].role");
    expect(findChange(changes, "getUserById").fieldPath).toBe("response.200.user.role");
  });

  it("request-field-added-required", async () => {
    const { changes, unmapped } = await diff("request-field-added-required");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "request-field-added-required",
      operationId: "updateUser",
      method: "PATCH",
      path: "/users/{id}",
      fieldPath: "request.body.updatedAt",
      breaking: true,
    });
  });

  it("request-field-removed", async () => {
    const { changes, unmapped } = await diff("request-field-removed");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "request-field-removed",
      operationId: "createPost",
      method: "POST",
      path: "/posts",
      fieldPath: "request.body.title",
      // level 2 (WARN) -- included in oasdiff's own `breaking` command output, so we
      // classify it as breaking too. See DECISIONS.md.
      breaking: true,
    });
  });

  it("param-added-required", async () => {
    const { changes, unmapped } = await diff("param-added-required");
    expect(unmapped).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "param-added-required",
      operationId: "listPosts",
      method: "GET",
      path: "/posts",
      fieldPath: "request.query.authorId",
      breaking: true,
    });
  });
});

describe("normalizeChanges unmapped/ignored handling (synthetic)", () => {
  it("never drops a change it doesn't recognize -- flags it as unmapped", () => {
    const mystery: RawOasdiffChange = {
      id: "some-future-oasdiff-check-id",
      text: "something changed that we've never seen before",
      level: 3,
      operation: "GET",
      operationId: "mysteryOp",
      path: "/mystery",
    };
    const { changes, unmapped } = normalizeChanges([mystery]);
    expect(changes).toEqual([]);
    expect(unmapped).toEqual([mystery]);
  });

  it("filters out meta-only notices (no operation/path) without surfacing them as unmapped", () => {
    const versionNotice: RawOasdiffChange = {
      id: "api-major-version-not-bumped",
      text: "a breaking change was detected but the major version did not increase",
      level: 1,
      section: "info",
    };
    const { changes, unmapped } = normalizeChanges([versionNotice]);
    expect(changes).toEqual([]);
    expect(unmapped).toEqual([]);
  });

  it("filters out a bare endpoint-added with no correlated removal (genuinely new endpoint)", () => {
    const newEndpoint: RawOasdiffChange = {
      id: "endpoint-added",
      text: "endpoint added",
      level: 1,
      operation: "GET",
      operationId: "brandNewOp",
      path: "/brand-new",
    };
    const { changes, unmapped } = normalizeChanges([newEndpoint]);
    expect(changes).toEqual([]);
    expect(unmapped).toEqual([]);
  });
});
