import { CreatePostForm } from "./components/CreatePostForm";
import { CurrentUserBadge } from "./components/CurrentUserBadge";
import { PostBadge } from "./components/PostBadge";
import { PostDetail } from "./components/PostDetail";
import { PostList } from "./components/PostList";
import { UpdateUserForm } from "./components/UpdateUserForm";
import { UserProfile } from "./components/UserProfile";
import { UsersTable } from "./components/UsersTable";

export function App() {
  return (
    <div>
      <CurrentUserBadge />
      <UserProfile userId="1" />
      <UpdateUserForm userId="1" />
      <UsersTable />
      <PostList />
      <PostDetail postId="1" />
      <PostBadge postId="1" />
      <CreatePostForm />
    </div>
  );
}
