import { normalizePathParams } from "@blast/spec-diff";

/** Strips the surrounding quote/backtick characters from a string/template literal's source text. */
export function unquote(text: string): string {
  return text.replace(/^[`'"]/, "").replace(/[`'"]$/, "");
}

/**
 * Turns a JS string/template-literal URL (already unquoted) into an OpenAPI-style path
 * pattern. Handles `${expr}` interpolations by taking the last dot-separated identifier in
 * the expression (e.g. `` `/posts/${queryArg.postId}` `` -> `/posts/{postId}`), then
 * normalizes through spec-diff's `normalizePathParams` so `{id}`/`:id`/`${id}` all compare
 * equal downstream.
 */
export function templateToPathPattern(raw: string): string {
  const withBraceParams = raw.replace(/\$\{\s*([^}]+?)\s*\}/g, (_match, expr: string) => {
    const parts = expr.split(".");
    const last = parts[parts.length - 1] ?? expr;
    return `{${last}}`;
  });
  return normalizePathParams(withBraceParams);
}
