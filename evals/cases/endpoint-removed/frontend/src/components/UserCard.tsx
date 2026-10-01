import type { User } from "../types";

// Target of the child-prop pass-through fixture: UserProfile passes `data.user` here as
// the `user` prop. See fixtures/MANIFEST.md.
export function UserCard({ user }: { user: User }) {
  return (
    <div className="user-card">
      <strong>{user.name}</strong>
      <span>{user.email}</span>
    </div>
  );
}
