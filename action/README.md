# API Blast Radius — GitHub Action

Runs `blast analyze` on a backend PR that touches your OpenAPI spec and posts one
(self-updating) PR comment listing every frontend endpoint, hook, component, field access
and Storybook story the change affects.

This is a **composite action** with no published package — it builds the `blast` CLI from
source out of this repo every run. `github-token` needs read access to the frontend repos
you list and `pull-requests: write` on the backend repo (to post/update the comment).

Currently assumes a Linux (`ubuntu-latest`) runner — the `oasdiff` install step downloads a
`linux_amd64` binary. See [`DECISIONS.md`](../DECISIONS.md) if you need another platform.

## Setup in your backend repo

**1. Add `.blastradius.yml`** at the repo root:

```yaml
# .blastradius.yml
spec: api/openapi.yaml          # path to your OpenAPI spec, relative to this repo's root

frontends:
  - repo: myorg/frontend-web     # owner/name of a repo that consumes this API
    ref: main                    # branch/tag/sha to check out
    path: apps/web               # optional: subdirectory, for a monorepo frontend
    codegen: npm run generate:api  # optional: run after checkout, before indexing
  - repo: myorg/frontend-mobile
    ref: main

failOn: breaking                 # "breaking" (fail the check on any breaking change) or "never"
testCommand: npm test            # optional; captured for Phase 4's patcher, not used yet
```

Every frontend repo needs its own `tsconfig.json` at (`path` +) its checkout root — that's
what `blast` points `ts-morph` at.

**2. Add a workflow** that triggers on PRs touching the spec path:

```yaml
# .github/workflows/blast-radius.yml
name: API Blast Radius
on:
  pull_request:
    paths:
      - "api/openapi.yaml"   # match your spec's path from .blastradius.yml

permissions:
  contents: read
  pull-requests: write

jobs:
  blast-radius:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed so the base ref's spec version is available to `git show`

      - uses: myorg/api-blast-radius/action@main   # note the /action suffix -- action.yml lives in this subdirectory
        with:
          github-token: ${{ secrets.BLAST_RADIUS_TOKEN }}   # needs read access to the frontend repos listed above
```

`secrets.GITHUB_TOKEN` only works if every frontend repo is in the *same* org/repo scope
that token can already read; for a private frontend repo in another org, use a PAT or a
GitHub App installation token with read access to it instead.

**3. Open a PR that changes `api/openapi.yaml`.** The action checks out each frontend repo,
runs its `codegen` command if given, analyzes the diff, and posts (or updates, on later
pushes to the same PR) one sticky comment.

## How it works

1. Builds `blast` from source (`pnpm install && pnpm run build` inside this action's own
   checked-out copy of the repo) — see [`DECISIONS.md`](../DECISIONS.md) for why there's no
   published package yet.
2. Parses `.blastradius.yml` (`action/scripts/parse-config.mjs`, backed by the tested
   `action/src/config.mjs`).
3. Extracts the spec's pre-PR version via `git show <base-sha>:<spec-path>`.
4. Shallow-clones each frontend repo at its configured ref (`action/scripts/checkout-frontends.mjs`)
   and runs its `codegen` command if one is set.
5. Runs `blast analyze --base <base-spec> --head <head-spec> --frontend <dir1>,<dir2>,...`.
6. Posts or updates the one sticky comment (`action/scripts/post-sticky-comment.mjs`,
   backed by `action/src/stickyComment.mjs`) using the `gh` CLI — no `@actions/github`
   dependency needed.
7. Fails the check if `failOn: breaking` and at least one breaking change was found
   (`action/scripts/check-fail.mjs`).

## Testing status

`action/src/*.mjs` (config parsing, checkout-plan building, the sticky-comment
find-or-create decision, the fail-policy check) are pure functions with unit tests in
`action/src/*.test.mjs`, run as part of the repo's normal `pnpm test`. The composite
`action.yml` itself — the actual GitHub Actions YAML, the `git`/`gh` CLI invocations — has
**not** been exercised in a live GitHub Actions run against a real backend/frontend repo
pair; that needs an actual GitHub environment to verify (repo checkout permissions, PR
comment permissions, etc. can't be faithfully simulated locally). If you hit an issue
running this for real, most likely places to look: the `oasdiff` download step (platform
mismatch), the frontend checkout step (token scope), or `github.action_path` resolution if
you reference this action without the `/action` path suffix.
