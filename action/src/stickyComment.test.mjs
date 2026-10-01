import { describe, expect, it } from "vitest";
import { STICKY_MARKER, findStickyCommentId, withMarker } from "./stickyComment.mjs";

describe("withMarker", () => {
  it("prepends the marker", () => {
    expect(withMarker("## Report\nhello")).toBe(`${STICKY_MARKER}\n## Report\nhello`);
  });

  it("doesn't double up if already present", () => {
    const already = `${STICKY_MARKER}\nfoo`;
    expect(withMarker(already)).toBe(already);
  });
});

describe("findStickyCommentId", () => {
  it("finds the comment carrying the marker among others", () => {
    const comments = [
      { id: 1, body: "unrelated comment" },
      { id: 2, body: `${STICKY_MARKER}\nold report` },
      { id: 3, body: "another unrelated comment" },
    ];
    expect(findStickyCommentId(comments)).toBe(2);
  });

  it("returns undefined when no sticky comment exists yet", () => {
    expect(findStickyCommentId([{ id: 1, body: "unrelated" }])).toBeUndefined();
  });

  it("returns undefined for an empty comment list", () => {
    expect(findStickyCommentId([])).toBeUndefined();
  });
});
