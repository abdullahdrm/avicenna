import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { House, FileText, User, LogOut } from "lucide-react";
import { logout } from "../lib/api";
import { useAuth } from "../App";

function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
      <span className="sidebar-link-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const { user, setAuthenticated, setUser } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setAuthenticated(false);
    setUser(null);
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">A</div>
          <div>
            <h2>Avicenna</h2>
            <p>Doctor Panel</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavItem to="/app/dashboard" icon={<House size={18} />} label="Dashboard" />
          <NavItem to="/app/cases" icon={<FileText size={18} />} label="Submissions" />
          <NavItem to="/app/pending-reviews" icon={<FileText size={18} />} label="Pending Reviews" />
          <NavItem to="/app/profile" icon={<User size={18} />} label="Profile" />
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {(user?.username || "D").slice(0, 1).toUpperCase()}
            </div>

            <div className="sidebar-user-meta">
              <strong>{user?.username || "Doctor"}</strong>
              <span>{user?.email || ""}</span>
            </div>
          </div>

          <button className="ghost-btn logout-btn full-width" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}