# Decisions

One line per non-obvious choice, newest last.

- Phase 0: pnpm workspace uses `tsc -b` project references across `packages/*`; `fixtures/demo-frontend` is typechecked separately (`tsc --noEmit`, bundler resolution, React JSX) and is deliberately excluded from the root reference graph since it's a fixture, not a library.
- Phase 0: `fixtures/demo-frontend`'s generated-codegen-style API (`src/api/generatedApi.ts`) is hand-authored to match the shape of real `@rtk-query/codegen-openapi` output (`injectEndpoints`, operationId-keyed builders) rather than produced by actually running the codegen tool, to keep the fixture deterministic and offline-friendly.
- Phase 0: `fixtures/specs/head-*.yaml` are hand-verified valid OpenAPI documents, one per `ChangeKind`, each a full copy of `v1.yaml` with exactly one targeted change. `oasdiff` isn't installed/exercised yet — that starts Phase 1.
- Phase 0: pnpm is invoked via `corepack pnpm` rather than a global `pnpm` binary, because `corepack enable`'s symlink step needs root on this machine.

