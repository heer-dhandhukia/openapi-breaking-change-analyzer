import { useGetUserQuery } from "../api/baseApi";
import { UserCard } from "./UserCard";

// Child-prop pass-through fixture: `data.user` is passed directly into <UserCard user={...} />
// one level deep. See fixtures/MANIFEST.md.
export function UserProfile({ userId }: { userId: string }) {
  const { data } = useGetUserQuery(userId);

  if (!data) {
    return null;
  }

  return (
    <div>
      <h2>{data.user.name}</h2>
      <p>{data.user.email}</p>
      <UserCard user={data.user} />
    </div>
  );
}
