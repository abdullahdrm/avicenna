import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../lib/api";
import { useAuth } from "../App";

export default function AppShell() {
  const { user, setAuthenticated, setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setAuthenticated(false);
      setUser(null);
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h2>Avicenna</h2>
            <p>Doctor Panel</p>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/app/dashboard">Dashboard</NavLink>
          <NavLink to="/app/cases">Cases</NavLink>
          <NavLink to="/app/pending">Pending Reviews</NavLink>
          <NavLink to="/app/reviewed">Reviewed Cases</NavLink>
          <NavLink to="/app/patients">Patients</NavLink>
          <NavLink to="/app/profile">Profile</NavLink>
          <NavLink to="/app/settings">Settings</NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <strong>{user?.username || "Doctor"}</strong>
            <span>{user?.email || ""}</span>
          </div>
          <button className="secondary-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Avicenna Clinical Review</h1>
            <p>Review AI-assisted dermatology cases from one place.</p>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}