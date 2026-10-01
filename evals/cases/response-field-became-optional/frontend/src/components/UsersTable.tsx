import { useGetUsersQuery } from "../api/generatedApi";

export function UsersTable() {
  const { data } = useGetUsersQuery();

  return (
    <table>
      <tbody>
        {data?.users.map((user) => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
