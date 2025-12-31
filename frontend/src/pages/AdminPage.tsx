import { Link } from "react-router-dom";

export default function AdminPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Admin</h1>
      <p>Choose an admin tool:</p>
      <ul>
        <li>
          <Link to="/admin/stores">Manage Stores</Link>
        </li>
        <li>
          <Link to="/admin/users">Manage Users</Link>
        </li>
      </ul>
    </div>
  );
}
