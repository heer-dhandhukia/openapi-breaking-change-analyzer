## API Blast Radius

**1** breaking change · **2** files affected · **0** stories affected

<details>
<summary>🔴 breaking — `path-changed`: GET /posts/{postId} (getPost)</summary>

api path removed without deprecation (now /posts/{postId}/full)

| Endpoint | Kind | File:Line | Symbol |
|---|---|---|---|
| getPost | hook-call | `src/components/PostBadge.tsx:6` | `useGetPostQuery` |
| getPost | field-access | `src/components/PostBadge.tsx:8` | `data.post.published` |
| getPost | field-access | `src/components/PostBadge.tsx:8` | `data.post.title` |
| getPost | hook-call | `src/components/PostDetail.tsx:4` | `useGetPostQuery` |
| getPost | field-access | `src/components/PostDetail.tsx:12` | `data.post.title` |
| getPost | field-access | `src/components/PostDetail.tsx:13` | `data.post.body` |

</details>
