import { useState } from "react";
import { useCreatePostMutation } from "../api/generatedApi";

export function CreatePostForm() {
  const [createPost, { isLoading }] = useCreatePostMutation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void createPost({ postBody: { title, body } });
  };

  return (
    <form onSubmit={onSubmit}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Body" />
      <button type="submit" disabled={isLoading}>
        Publish
      </button>
    </form>
  );
}
