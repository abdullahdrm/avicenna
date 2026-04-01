import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import AppShell from "./components/AppShell";
import { getCurrentUser } from "./lib/api";
import PendingPage from "./pages/PendingPage";
import ReviewedPage from "./pages/ReviewedPage";
import PatientsPage from "./pages/PatientsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center-screen"><div className="loader" /></div>;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((data) => {
        if (!mounted) return;
        if (data?.authenticated && data?.user?.role === "doctor") {
          setAuthenticated(true);
          setUser(data.user);
        } else {
          setAuthenticated(false);
          setUser(null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      setAuthenticated,
      user,
      setUser,
      loading,
      setLoading,
    }),
    [authenticated, user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="pending" element={<PendingPage />} />
          <Route path="reviewed" element={<ReviewedPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthContext.Provider>
    
  );
}
