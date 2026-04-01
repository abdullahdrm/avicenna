import { useAuth } from "../App";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <section className="panel">
      <h3>Doctor Profile</h3>
      <div className="meta-list">
        <div>
          <span>Username</span>
          <strong>{user?.username || "-"}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{user?.email || "-"}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{user?.role || "-"}</strong>
        </div>
      </div>
    </section>
  );
}