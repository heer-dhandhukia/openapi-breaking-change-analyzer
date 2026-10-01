import { useListPostsQuery } from "../api/baseApi";
import { PostItem } from "./PostItem";

// Object-spread fixture: each post is spread into <PostItem {...post} /> rather than
// passed as a single named prop. See fixtures/MANIFEST.md.
export function PostList() {
  const { data: posts } = useListPostsQuery();

  return (
    <ul>
      {posts?.map((post) => (
        <PostItem key={post.id} {...post} />
      ))}
    </ul>
  );
}
