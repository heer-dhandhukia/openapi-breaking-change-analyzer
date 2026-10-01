import { useGetUserQuery } from "../api/baseApi";

const CURRENT_USER_ID = "current";

// Wraps an RTK Query hook. A field read reached through this indirection (rather than a
// direct useXQuery/useXMutation call) is the fe-index "deeper flow" case -> confidence
// should be 'possible', not 'exact'. See fixtures/MANIFEST.md.
export function useCurrentUser() {
  const { data, isLoading } = useGetUserQuery(CURRENT_USER_ID);
  return { user: data?.user, isLoading };
}
