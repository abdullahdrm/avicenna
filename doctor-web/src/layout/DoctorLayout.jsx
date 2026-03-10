import { NavLink, Outlet } from "react-router-dom";
import { FileText, Home, User } from "lucide-react";
import logo from "../assets/logo.png";

const navItems = [
  { to: "/doctor", label: "Dashboard", icon: Home, end: true },
  { to: "/doctor/submissions", label: "Submissions", icon: FileText },
  { to: "/doctor/profile", label: "Profile", icon: User },
];

export default function DoctorLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="w-full border-b border-slate-200 bg-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="p-6">
          <div className="rounded-3xl bg-gradient-to-br from-sky-50 to-blue-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Avicenna"
                className="h-14 w-14 rounded-2xl object-contain bg-white p-1 shadow-sm"
              />
              <div>
                <h1 className="text-lg font-bold text-slate-900">Avicenna</h1>
                <p className="text-sm text-slate-500">Doctor Panel</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 flex flex-wrap gap-2 lg:flex-col">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}