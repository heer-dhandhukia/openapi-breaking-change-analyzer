import { useGetPostQuery } from "../api/generatedApi";

export function PostDetail({ postId }: { postId: string }) {
  const { data } = useGetPostQuery({ postId });

  if (!data) {
    return null;
  }

  return (
    <article>
      <h1>{data.post.title}</h1>
      <p>{data.post.body}</p>
    </article>
  );
}
