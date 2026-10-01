import { useState } from "react";
import { useUpdateUserMutation } from "../api/baseApi";

export function UpdateUserForm({ userId }: { userId: string }) {
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const [name, setName] = useState("");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void updateUser({ id: userId, patch: { name } });
  };

  return (
    <form onSubmit={onSubmit}>
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <button type="submit" disabled={isLoading}>
        Save
      </button>
    </form>
  );
}
