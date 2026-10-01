import { useCurrentUser } from "../hooks/useCurrentUser";

// Reads `user.email` through the useCurrentUser wrapper hook rather than a direct
// useXQuery call -> the fe-index matcher should mark this 'possible', not 'exact'.
// See fixtures/MANIFEST.md.
export function CurrentUserBadge() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) {
    return null;
  }

  return <span>{user.email}</span>;
}
