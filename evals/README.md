# evals

Measures the whole pipeline's accuracy against known-answer cases: impact precision/recall
(split by `exact` vs `possible` confidence), and — when explicitly requested — the
patcher's verify-pass rate, cost, and time.

```bash
pnpm gen:cases          # (re)generate the 10 seed cases from fixtures/ -- see below
pnpm build
pnpm eval                # impact precision/recall only (no API calls, no cost)
pnpm eval --with-patches # also runs the real patcher on every case's exact impacts
                          # (needs ANTHROPIC_API_KEY -- spends real money, skipped otherwise)
```

## Case format

Each case is a self-contained directory under `evals/cases/<name>/`:

```
evals/cases/<name>/
  base.yaml       # OpenAPI spec before the change
  head.yaml       # OpenAPI spec after the change
  frontend/       # a full frontend snapshot -- its own tsconfig.json, src/, etc.
  expected.json   # ground truth
```

`expected.json`:

```json
{
  "expectedImpacts": [
    { "endpoint": "getUsers", "kind": "response-field-removed", "confidence": "exact" }
  ]
}
```

`endpoint` is the endpoint's name as fe-index would report it (the `builder.query`/
`builder.mutation` object key, e.g. `getUsers` — not necessarily the spec's `operationId`).
`kind` is one of the 10 `ChangeKind`s from `packages/impact/src/types.ts`. `confidence` is
`"exact"` or `"possible"`.

**Why this minimal shape instead of full `Impact` objects**: a full `Impact` includes
`change.detail` (oasdiff's own wording) and the complete `sites` array — both would make
every case brittle to an oasdiff version bump or a fe-index refactor that changes exactly
*how* something is found without changing *whether* it should be found. `(endpoint, kind,
confidence)` is the actual claim being tested; that's what's worth pinning.

**Why "frontend snapshot" is a real copy, not a symlink or a shared fixture reference**: an
eval case pins a specific, known-good frontend state. If `fixtures/demo-frontend` changes
later for an unrelated reason (a new fixture, a bug fix), an eval case's own frontend must
not silently drift with it — that would make a regression in the matcher look like a
regression in the fixture, or vice versa, and defeats the purpose of having a fixed
baseline to score against.

## The 10 seed cases

`scripts/generate-cases-from-fixtures.mjs` builds all 10 from what Phases 0-2 already
built and verified: `fixtures/specs/{v1,head-<kind>}.yaml` become `base.yaml`/`head.yaml`,
`fixtures/demo-frontend` is snapshotted into `frontend/` (with `node_modules` **symlinked**
back to the real fixture's install rather than reinstalled per case — keeps 10 cases cheap
and consistent with how their own `expected.json` was derived), and `expected.json` is
generated from `packages/impact/test/golden/<kind>.json` (Phase 2's own golden files,
already hand-verified against the real pipeline). Re-run the generator only if you want to
regenerate these 10 from scratch (e.g. after a fixture-level change) — it's destructive to
existing content in those 10 case directories.

## Adding a real case (up to 30 total)

1. Create `evals/cases/<descriptive-name>/`.
2. Drop in `base.yaml` / `head.yaml` (real specs, or a trimmed excerpt of them).
3. Copy a real frontend snapshot into `frontend/` — it needs its own `tsconfig.json` at the
   root (or set up the same way `fixtures/demo-frontend`'s is) since that's what `ts-morph`
   is pointed at. Do **not** commit `node_modules` — either `pnpm install` inside it before
   running evals locally, or symlink to an existing install the way the generator script
   does.
4. Write `expected.json` by hand: run `pnpm eval` once first (it'll show 100% FN for a case
   with an empty `expectedImpacts: []`, which at least confirms the case loads), inspect
   what the pipeline actually finds, and record what *should* be found — don't just copy
   the tool's own output as ground truth, since that only tests for stability, not
   correctness.
5. `pnpm eval` picks up every directory under `evals/cases/` automatically — no registration
   step beyond adding the directory.

## Reading the report

- **Per-case rows**: raw TP/FP/FN counts per confidence bucket, plus unmatched-change count
  and pipeline time.
- **Aggregate**: micro-averaged (summed counts across all cases, then one precision/recall
  computed from the sum) rather than averaging each case's own precision/recall — more
  robust with a small, uneven number of expected impacts per case. Precision/recall default
  to 100% when there's nothing to divide by (an empty expected set with nothing found is
  vacuously "correct," not `NaN`).
- **Confidence buckets are strict and non-overlapping**: finding something as `exact` when
  only `possible` was expected does **not** count as a `possible`-bucket hit (it's a
  different, stronger claim than what was expected) — see `scoring.ts`'s tests for the
  exact semantics. This means a matcher that's "better than expected" shows up as a
  possible-bucket false negative *and* an exact-bucket false positive, not as a free win.
  Worth knowing before concluding a metric regression means the matcher got worse.
- **Patch verification** is skipped by default (`pnpm eval` alone never spends money);
  `--with-patches` runs the real `AnthropicLlmClient` against every case's `exact` impacts,
  in a throwaway git copy of that case's `frontend/` (same technique as
  `packages/patcher`'s own tests), and reports verify-pass rate, avg cost, avg time per
  file.
