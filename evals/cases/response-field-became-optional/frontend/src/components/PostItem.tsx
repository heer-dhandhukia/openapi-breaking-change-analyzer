import type { Post } from "../types";

// Target of the object-spread fixture: PostList renders <PostItem {...post} />.
// See fixtures/MANIFEST.md.
export function PostItem({ title, body }: Pick<Post, "title" | "body">) {
  return (
    <li>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  );
}
