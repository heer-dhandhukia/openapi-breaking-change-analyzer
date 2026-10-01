// A hidden marker identifying "the" blast-radius comment on a PR, so re-runs update it
// instead of piling up a new comment every push.
export const STICKY_MARKER = "<!-- blast-radius-report -->";

/** @param {string} markdown @returns {string} */
export function withMarker(markdown) {
  return markdown.includes(STICKY_MARKER) ? markdown : `${STICKY_MARKER}\n${markdown}`;
}

/**
 * @param {Array<{id: number, body: string}>} comments
 * @returns {number | undefined}
 */
export function findStickyCommentId(comments) {
  return comments.find((comment) => comment.body.includes(STICKY_MARKER))?.id;
}
