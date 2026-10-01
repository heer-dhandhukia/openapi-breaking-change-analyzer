import { useGetPostQuery } from "../api/generatedApi";

// Conditional-render fixture: `data.post.title` and `data.post.published` are only read
// inside the `&&` guard chain, never in a top-level statement. See fixtures/MANIFEST.md.
export function PostBadge({ postId }: { postId: string }) {
  const { data } = useGetPostQuery({ postId });

  return <>{data && data.post.published && <span>{data.post.title}</span>}</>;
}
