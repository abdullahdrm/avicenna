import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDoctorDashboard, fetchDoctorSubmissions } from "../lib/api";

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const reviewed = status === "reviewed";
  return (
    <span className={`status-badge ${reviewed ? "reviewed" : "pending"}`}>
      {reviewed ? "Completed" : "Pending Review"}
    </span>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchDoctorDashboard(), fetchDoctorSubmissions()])
      .then(([dashboardData, submissionsData]) => {
        setDashboard(dashboardData);
        setSubmissions(submissionsData?.results || []);
      })
      .catch((e) => setError(e.message || "Failed to load dashboard."));
  }, []);

  const pendingCount = submissions.filter((x) => x.status === "pending").length;
  const reviewedCount = submissions.filter((x) => x.status === "reviewed").length;

  return (
    <div className="dashboard-page">
      <section className="blue-hero">
        <div>
          <h1>Hello Dr. {dashboard?.doctor?.first_name || "Doctor"} {dashboard?.doctor?.last_name || ""}</h1>
          <p>Review and manage patient submissions</p>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard value={pendingCount} label="Pending Submissions" />
        <StatCard value={reviewedCount} label="Completed Reviews" />
        <StatCard value={submissions.length} label="Patients / Cases" />
      </section>

      <section className="section-block">
        <div className="section-head">
          <h3>Quick Actions</h3>
        </div>

        <div className="action-grid">
          <Link className="action-card primary-action" to="/app/pending-reviews">
            <div className="action-title">Pending Reviews</div>
            <div className="action-sub">Open waiting cases</div>
          </Link>

          <Link className="action-card" to="/app/cases">
            <div className="action-title dark">All Submissions</div>
            <div className="action-sub">Browse all patient submissions</div>
          </Link>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h3>Latest Submissions</h3>
          <Link className="inline-link" to="/app/cases">View All</Link>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        {!error && submissions.length === 0 ? (
          <div className="empty-card">No recent submissions</div>
        ) : (
          <div className="submission-list">
            {submissions.slice(0, 5).map((item) => (
              <Link className="submission-card" to={`/app/cases/${item.id}`} key={item.id}>
                <div className="submission-left">
                  <div className={`round-icon ${item.status === "reviewed" ? "green" : "orange"}`}>
                    {item.status === "reviewed" ? "✓" : "⏳"}
                  </div>
                  <div>
                    <div className="submission-name">
                      {item.patient?.first_name || "Patient"} {item.patient?.last_name || ""}
                    </div>
                    <div className="submission-date">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}