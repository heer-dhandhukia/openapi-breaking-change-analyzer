import { describe, expect, it } from "vitest";
import { normalizePathParams } from "./pathParams.js";

describe("normalizePathParams", () => {
  it("treats {id}, :id and ${id} as equal", () => {
    expect(normalizePathParams("/users/{id}")).toBe("/users/{id}");
    expect(normalizePathParams("/users/:id")).toBe("/users/{id}");
    expect(normalizePathParams("/users/${id}")).toBe("/users/{id}");
  });

  it("normalizes multiple params in one path", () => {
    expect(normalizePathParams("/users/:userId/posts/:postId")).toBe("/users/{userId}/posts/{postId}");
    expect(normalizePathParams("/users/${userId}/posts/${postId}")).toBe("/users/{userId}/posts/{postId}");
  });

  it("leaves paths without params untouched", () => {
    expect(normalizePathParams("/posts")).toBe("/posts");
  });
});
