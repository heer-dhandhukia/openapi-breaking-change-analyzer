# Fixture Manifest

Maps every test case Phase 1+ golden tests will rely on to the exact file and line that
covers it. Line numbers verified against the files as committed in Phase 0 — re-run the
`grep -n` commands below if these fixtures are ever edited, and update this file in the
same commit.

## ChangeKind fixtures (`fixtures/specs`)

Base spec: [`fixtures/specs/v1.yaml`](specs/v1.yaml). Each `head-*.yaml` is a full copy of
`v1.yaml` with exactly one targeted change (marked inline with a `# <ChangeKind>: ...`
comment), paired with a real demo-frontend usage site so later impact tests have something
concrete to assert against.

| ChangeKind | Base (`v1.yaml`) | Head spec | What changed | Frontend site affected |
|---|---|---|---|---|
| `endpoint-removed` | [`v1.yaml:113`](specs/v1.yaml:113) `operationId: getPost` | [`head-endpoint-removed.yaml:111`](specs/head-endpoint-removed.yaml:111) | `GET /posts/{postId}` (`getPost`) removed entirely | [`PostDetail.tsx:4`](demo-frontend/src/components/PostDetail.tsx:4), [`PostBadge.tsx:6`](demo-frontend/src/components/PostBadge.tsx:6) call `useGetPostQuery` |
| `method-changed` | [`v1.yaml:43`](specs/v1.yaml:43) `operationId: updateUser` under `patch:` | [`head-method-changed.yaml:42-44`](specs/head-method-changed.yaml:42) | `updateUser` moved from `PATCH` to `PUT` | [`UpdateUserForm.tsx:10`](demo-frontend/src/components/UpdateUserForm.tsx:10) calls `updateUser(...)` |
| `path-changed` | [`v1.yaml:113`](specs/v1.yaml:113) path `/posts/{postId}` | [`head-path-changed.yaml:111-112`](specs/head-path-changed.yaml:111) | path renamed to `/posts/{postId}/full`, `operationId: getPost` unchanged | [`PostDetail.tsx:4`](demo-frontend/src/components/PostDetail.tsx:4), [`PostBadge.tsx:6`](demo-frontend/src/components/PostBadge.tsx:6) |
| `response-field-removed` | [`v1.yaml:143-145`](specs/v1.yaml:143) `User.role` property | [`head-response-field-removed.yaml:134-137`](specs/head-response-field-removed.yaml:134) | `role` dropped from `User` properties and `required` | [`UsersTable.tsx:12`](demo-frontend/src/components/UsersTable.tsx:12) reads `user.role` |
| `response-field-type-changed` | [`v1.yaml:156-157`](specs/v1.yaml:156) `Post.published: boolean` | [`head-response-field-type-changed.yaml:157-160`](specs/head-response-field-type-changed.yaml:157) | `Post.published` type `boolean` → `string` | [`PostBadge.tsx:8`](demo-frontend/src/components/PostBadge.tsx:8) reads `data.post.published` |
| `response-field-became-optional` | [`v1.yaml:135`](specs/v1.yaml:135) `required: [id, name, email, role]` | [`head-response-field-became-optional.yaml:134-138`](specs/head-response-field-became-optional.yaml:134) | `email` dropped from `required` (property stays) | [`UserProfile.tsx:16`](demo-frontend/src/components/UserProfile.tsx:16), [`UserCard.tsx:9`](demo-frontend/src/components/UserCard.tsx:9), [`CurrentUserBadge.tsx:13`](demo-frontend/src/components/CurrentUserBadge.tsx:13) all read `user.email` |
| `enum-value-removed` | [`v1.yaml:144-145`](specs/v1.yaml:144) `enum: [admin, member, guest]` | [`head-enum-value-removed.yaml:144-147`](specs/head-enum-value-removed.yaml:144) | `guest` dropped from `User.role` enum | [`UsersTable.tsx:12`](demo-frontend/src/components/UsersTable.tsx:12) reads `user.role` |
| `request-field-added-required` | [`v1.yaml:50-62`](specs/v1.yaml:50) `updateUser` request body | [`head-request-field-added-required.yaml:56-66`](specs/head-request-field-added-required.yaml:56) | new required field `updatedAt` added | [`UpdateUserForm.tsx:10`](demo-frontend/src/components/UpdateUserForm.tsx:10) sends `{ id, patch: { name } }` only |
| `request-field-removed` | [`v1.yaml:88-99`](specs/v1.yaml:88) `createPost` request body | [`head-request-field-removed.yaml:94-98`](specs/head-request-field-removed.yaml:94) | `title` dropped entirely | [`CreatePostForm.tsx:11`](demo-frontend/src/components/CreatePostForm.tsx:11) sends `{ postBody: { title, body } }` |
| `param-added-required` | [`v1.yaml:76`](specs/v1.yaml:76) `operationId: listPosts` (no params) | [`head-param-added-required.yaml:77-84`](specs/head-param-added-required.yaml:77) | new required query param `authorId` | [`PostList.tsx:7`](demo-frontend/src/components/PostList.tsx:7) calls `useListPostsQuery()` with no args |

## Frontend matching-rule fixtures (`fixtures/demo-frontend`)

| Case | File : line | Detail |
|---|---|---|
| Child-prop pass-through | [`UserProfile.tsx:17`](demo-frontend/src/components/UserProfile.tsx:17) → [`UserCard.tsx:5`](demo-frontend/src/components/UserCard.tsx:5) | `<UserCard user={data.user} />`; `UserCard` destructures `{ user }` and reads `user.name` ([`UserCard.tsx:8`](demo-frontend/src/components/UserCard.tsx:8)) / `user.email` ([`UserCard.tsx:9`](demo-frontend/src/components/UserCard.tsx:9)) one level deep |
| Object spread | [`PostList.tsx:12`](demo-frontend/src/components/PostList.tsx:12) → [`PostItem.tsx:5`](demo-frontend/src/components/PostItem.tsx:5) | `<PostItem {...post} />`; `PostItem` receives spread props, no direct `post.<field>` access is traceable through the spread |
| Custom hook wrapping an RTK hook (→ `possible`) | [`useCurrentUser.ts:9`](demo-frontend/src/hooks/useCurrentUser.ts:9) wraps `useGetUserQuery`; consumed at [`CurrentUserBadge.tsx:7`](demo-frontend/src/components/CurrentUserBadge.tsx:7), field read at [`CurrentUserBadge.tsx:13`](demo-frontend/src/components/CurrentUserBadge.tsx:13) | `user.email` is reached through `useCurrentUser()`, not a direct `useXQuery`/`useXMutation` call — matching rule 4's "deeper flow" case, confidence should be `possible` |
| Conditional-render field access | [`PostBadge.tsx:8`](demo-frontend/src/components/PostBadge.tsx:8) | `{data && data.post.published && <span>{data.post.title}</span>}` — `data.post.published` and `data.post.title` are read only inside the `&&` guard chain, never in a top-level statement; should still resolve to `exact` |

## Endpoint definitions (`fixtures/demo-frontend/src/api`)

| Endpoint | Kind | Defined at | Hooks |
|---|---|---|---|
| `getUser` | hand-written query | [`baseApi.ts:9`](demo-frontend/src/api/baseApi.ts:9) | `useGetUserQuery` — used directly at [`UserProfile.tsx:7`](demo-frontend/src/components/UserProfile.tsx:7), indirectly via `useCurrentUser` ([`useCurrentUser.ts:9`](demo-frontend/src/hooks/useCurrentUser.ts:9)) |
| `updateUser` | hand-written mutation | [`baseApi.ts:13`](demo-frontend/src/api/baseApi.ts:13) | `useUpdateUserMutation` — [`UpdateUserForm.tsx:5`](demo-frontend/src/components/UpdateUserForm.tsx:5) |
| `listPosts` | hand-written query | [`baseApi.ts:21`](demo-frontend/src/api/baseApi.ts:21) | `useListPostsQuery` — [`PostList.tsx:7`](demo-frontend/src/components/PostList.tsx:7) |
| `getUsers` | codegen-openapi-style query | [`generatedApi.ts:15`](demo-frontend/src/api/generatedApi.ts:15) | `useGetUsersQuery` — [`UsersTable.tsx:4`](demo-frontend/src/components/UsersTable.tsx:4) |
| `getPost` | codegen-openapi-style query | [`generatedApi.ts:19`](demo-frontend/src/api/generatedApi.ts:19) | `useGetPostQuery` — [`PostDetail.tsx:4`](demo-frontend/src/components/PostDetail.tsx:4), [`PostBadge.tsx:6`](demo-frontend/src/components/PostBadge.tsx:6) |
| `createPost` | codegen-openapi-style mutation | [`generatedApi.ts:23`](demo-frontend/src/api/generatedApi.ts:23) | `useCreatePostMutation` — [`CreatePostForm.tsx:5`](demo-frontend/src/components/CreatePostForm.tsx:5) |

## Stories (`fixtures/demo-frontend/stories`)

5 CSF3 stories: `UserProfile.stories.tsx`, `UserCard.stories.tsx`, `PostList.stories.tsx`,
`PostItem.stories.tsx`, `UpdateUserForm.stories.tsx` — each imports its component directly,
covering matching rule 5 ("any `*.stories.tsx` importing an affected component").
