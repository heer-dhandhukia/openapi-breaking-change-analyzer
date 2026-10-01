## API Blast Radius

**1** breaking change · **1** file affected · **1** story affected

<details>
<summary>🔴 breaking — `param-added-required`: GET /posts (listPosts)</summary>

added the new required `query` request parameter `authorId`

| Endpoint | Kind | File:Line | Symbol |
|---|---|---|---|
| listPosts | hook-call | `src/components/PostList.tsx:7` | `useListPostsQuery` |
| listPosts | field-access | `src/components/PostList.tsx:11` | `posts` |
| listPosts | field-access | `src/components/PostList.tsx:12` | `posts[].id` |
| listPosts | field-access | `src/components/PostList.tsx:12` | `posts[]` |

</details>
