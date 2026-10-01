## API Blast Radius

**1** breaking change · **2** files affected · **2** stories affected

<details>
<summary>🔴 breaking — `response-field-became-optional`: GET /users/{id} (getUserById)</summary>

the response property `user/email` became optional for the status `200`

| Endpoint | Kind | File:Line | Symbol |
|---|---|---|---|
| getUser | field-access | `src/components/UserProfile.tsx:16` | `data.user.email` |
| getUser | field-access | `src/components/UserCard.tsx:9` | `data.user.email` |

</details>
