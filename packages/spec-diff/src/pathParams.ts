// Matches `{id}` (OpenAPI), `:id` (Express-style), and `${id}` (JS template literal) path
// parameter placeholders so all three spellings compare equal. OpenAPI specs always use
// `{id}`; the other two forms exist so fe-index can reuse this to normalize frontend
// `query:` URL templates (e.g. `` `/users/${id}` ``) for matching against SpecChange.path.
const PARAM_PATTERN = /\{([^}]+)\}|:([A-Za-z_$][\w$]*)|\$\{([^}]+)\}/g;

export function normalizePathParams(path: string): string {
  return path.replace(PARAM_PATTERN, (_match, brace: string, colon: string, template: string) => {
    const name = brace ?? colon ?? template;
    return `{${name}}`;
  });
}
