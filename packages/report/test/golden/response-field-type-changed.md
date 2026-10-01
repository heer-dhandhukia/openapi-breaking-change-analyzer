## API Blast Radius

**2** breaking changes · **2** files affected · **1** story affected

<details>
<summary>🔴 breaking — `response-field-type-changed`: GET /posts/{postId} (getPost)</summary>

the `post/published` response's property `type` changed from `boolean` to `string` for status `200` (boolean -> string)

| Endpoint | Kind | File:Line | Symbol |
|---|---|---|---|
| getPost | field-access | `src/components/PostBadge.tsx:8` | `data.post.published` |

</details>

<details>
<summary>Possible impacts (1)</summary>

| Change | Endpoint | Kind | File:Line | Symbol |
|---|---|---|---|---|
| `response-field-type-changed`: GET /posts (listPosts) | listPosts | field-access | `src/components/PostList.tsx:12` | `posts[]` |

</details>
