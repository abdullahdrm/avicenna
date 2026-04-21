import { useEffect, useState } from "react";
import { fetchDoctorProfile, logout } from "../lib/api";
import { useAuth } from "../App";
import { useNavigate } from "react-router-dom";

function InfoRow({ label, value, last = false }) {
  return (
    <div className={`info-row ${last ? "last" : ""}`}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-value">{value}</div>
      <div className="mini-stat-label">{label}</div>
    </div>
  );
}

function formatDays(days) {
  if (!days || !days.length) return "-";
  return days.join(" – ");
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const { setAuthenticated, setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDoctorProfile()
      .then((data) => setProfile(data))
      .catch((e) => setError(e.message || "Failed to load doctor profile."));
  }, []);

  function handleLogout() {
    logout();
    setAuthenticated(false);
    setUser(null);
    navigate("/login", { replace: true });
  }

  if (!profile && !error) {
    return (
      <div className="center-screen" style={{ minHeight: "60vh" }}>
        <div className="loader" />
      </div>
    );
  }

  const user = profile?.user || profile || {};

  return (
    <div className="profile-page">
      {error ? <div className="error-box">{error}</div> : null}

      <section className="profile-header-card">
        <div className="profile-top">
          <div className="avatar-circle" />
          <div>
            <h1>{user.first_name || user.username || "Doctor"} {user.last_name || ""}</h1>
            <p>{user.email || "-"}</p>
          </div>
        </div>

        <div className="profile-stats">
          <Stat value={profile?.stats?.patients_count ?? 0} label="PATIENTS" />
          <div className="profile-divider" />
          <Stat value={profile?.stats?.submissions_reviewed ?? 0} label="REVIEWED" />
          <div className="profile-divider" />
          <Stat value={profile?.stats?.active_days ?? 0} label="DAYS" />
        </div>
      </section>

      <div className="profile-body">
        <section className="white-card">
          <h3>Professional Details</h3>
          <InfoRow label="Username" value={user.username} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.role} />
          <InfoRow label="Hospital" value={profile?.hospital} />
          <InfoRow label="City" value={profile?.city} />
          <InfoRow
            label="Experience"
            value={profile?.experience_years ? `${profile.experience_years} years` : "-"}
            last
          />
        </section>

        <section className="white-card">
          <div className="section-head">
            <h3>Preferences</h3>
            <button className="inline-link-btn" type="button">
              Edit
            </button>
          </div>

          <InfoRow label="Preferred Days" value={formatDays(profile?.allowed_days)} />
          <InfoRow label="Max / Day" value={profile?.max_submissions_per_day} last />
        </section>

        <button className="ghost-btn full-width" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}