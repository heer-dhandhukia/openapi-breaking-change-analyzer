# Decisions

One line per non-obvious choice, newest last.

- Phase 0: pnpm workspace uses `tsc -b` project references across `packages/*`; `fixtures/demo-frontend` is typechecked separately (`tsc --noEmit`, bundler resolution, React JSX) and is deliberately excluded from the root reference graph since it's a fixture, not a library.
- Phase 0: `fixtures/demo-frontend`'s generated-codegen-style API (`src/api/generatedApi.ts`) is hand-authored to match the shape of real `@rtk-query/codegen-openapi` output (`injectEndpoints`, operationId-keyed builders) rather than produced by actually running the codegen tool, to keep the fixture deterministic and offline-friendly.
- Phase 0: `fixtures/specs/head-*.yaml` are hand-verified valid OpenAPI documents, one per `ChangeKind`, each a full copy of `v1.yaml` with exactly one targeted change. `oasdiff` isn't installed/exercised yet — that starts Phase 1.
- Phase 0: pnpm is invoked via `corepack pnpm` rather than a global `pnpm` binary, because `corepack enable`'s symlink step needs root on this machine.

## Phase 1A: spec-diff / oasdiff

- `oasdiff` v1.32.1 is vendored at `.tools/oasdiff` (gitignored) — no brew/go available on this machine to install it properly. `packages/spec-diff/src/oasdiffClient.ts` resolves the binary via `OASDIFF_BIN` env var, falling back to `oasdiff` on `PATH`; a real dev machine/CI should install oasdiff normally and rely on the PATH fallback. `vitest.config.ts` sets `OASDIFF_BIN` to the vendored path so tests are self-contained here.
- We use `oasdiff changelog <base> <revision> -f json`, not `breaking` or `diff`: `changelog` is the only command that reports every change (breaking and non-breaking) with a stable per-change `id`, which is what we need to build a ChangeKind mapping. Confirmed shape via `oasdiff schema` (JSON Schema for `--format json`, `additionalProperties: false`): `{id, text, level, operation?, operationId?, path?, section?, baseSource?, revisionSource?, fingerprint?}`. No dedicated field for the exact property path that changed — it's embedded in `text` only.
- `SpecChange.breaking = (oasdiff level >= 2)`, not `level === 3`. Verified empirically: running oasdiff's own `breaking` command on our `request-field-removed` fixture (`request-property-removed`, level 2/WARN) includes it in the breaking-changes output; running it on `enum-value-removed` (level 1/INFO) returns `[]`. So oasdiff's own breaking threshold is WARN-or-above, and we mirror that rather than inventing our own threshold.
- **oasdiff id → ChangeKind mapping** (the full table; `text` regexes live in `normalize.ts`'s `FIELD_EXTRACTORS`):

  | oasdiff id | ChangeKind | notes |
  |---|---|---|
  | `api-path-removed-without-deprecation` | `endpoint-removed` (or correlated into `method-changed`/`path-changed`, see below) | whole path removed |
  | `api-removed-without-deprecation` | `endpoint-removed` (or correlated, see below) | one operation removed from a path that may still have other methods |
  | `response-required-property-removed` | `response-field-removed` | |
  | `response-property-type-changed` | `response-field-type-changed` | |
  | `response-property-became-optional` | `response-field-became-optional` | |
  | `response-property-enum-value-removed` | `enum-value-removed` | level 1/INFO in practice — narrows the response, not breaking |
  | `new-required-request-property` | `request-field-added-required` | |
  | `request-property-removed` | `request-field-removed` | level 2/WARN in practice, still `breaking: true` per the rule above |
  | `new-required-request-parameter` | `param-added-required` | |

- **`method-changed`/`path-changed` have no dedicated oasdiff id.** oasdiff always represents "the same operation moved" as a removal (one of the two ids above) plus a separate, non-breaking `endpoint-added` for the new shape. `normalize.ts` correlates a removal and an `endpoint-added` when they share the same non-empty `operationId`: same path + different method → `method-changed`; same method + different path → `path-changed`; both differ (not exercised by any fixture — genuinely ambiguous) → falls back to reporting the removal alone as `endpoint-removed` rather than guessing. A removal with no correlated addition → `endpoint-removed`. An `endpoint-added` with no correlated removal is a genuinely new endpoint and is silently ignored (see below) — nothing in an existing frontend can depend on an endpoint that didn't exist before.
- **Ignored vs. unmapped — two different buckets, not one.** "Unmapped" (per the task's requirement 4) means an oasdiff id we don't recognize at all — those are always pushed to the `unmapped` array, never dropped. Separately, there's a small **ignore-list** (`api-major-version-not-bumped`, and a `endpoint-added` that didn't correlate to any removal) of ids we *do* recognize but that aren't API-surface changes at all: `api-major-version-not-bumped` has no `operation`/`path`/`operationId` (it's a semver-hygiene notice about the diff itself, not a `SpecChange` — `SpecChange.method`/`.path` are required fields, so it couldn't be represented even if we wanted to), and a non-correlated `endpoint-added` describes a new capability, not a break. Both are filtered out deliberately and documented here rather than silently vanishing into "unmapped" alongside genuinely-unrecognized ids.
- **fieldPath format**: `<request|response>.<status-or-param-location>.<dotted.path>`, with array-typed segments (oasdiff's `items` path segment) rendered as `[]` attached to the preceding segment (e.g. oasdiff's `users/items/role` → `response.200.users[].role`; a top-level array response's `items/published` → `response.200.[].published`). Request-body fields: `request.body.<field>` (e.g. `request.body.title`). Request parameters: `request.<location>.<name>` (e.g. `request.query.authorId`), where `<location>` is oasdiff's own parameter location string (`query`, `path`, `header`, ...).
- Field-path extraction is regex-based against oasdiff's fixed `text` templates (there's no structured field for it) and is anchored to the exact v1.32.1 wording confirmed against real fixture runs. If a future oasdiff version rewords a message, the regex simply fails to match and the raw change falls through to `unmapped` (visible, not silently wrong) rather than producing an incorrect fieldPath.

