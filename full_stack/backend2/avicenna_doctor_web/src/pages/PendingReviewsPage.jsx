import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDoctorSubmissions } from "../lib/api";

function StatusBadge({ status }) {
  const reviewed = status === "reviewed";
  return (
    <span className={`status-badge ${reviewed ? "reviewed" : "pending"}`}>
      {reviewed ? "Reviewed" : "Under Review"}
    </span>
  );
}

export default function PendingReviewsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDoctorSubmissions()
      .then((data) => setItems(data?.results || []))
      .catch((e) => setError(e.message || "Failed to load submissions."));
  }, []);

  const counts = {
    all: items.length,
    pending: items.filter((x) => x.status === "pending").length,
    reviewed: items.filter((x) => x.status === "reviewed").length,
  };

  const filtered =
    filter === "all" ? items : items.filter((item) => item.status === filter);

  return (
    <div className="cases-page">
      <section className="blue-hero compact">
        <div>
          <h1>Patient Submissions</h1>
          <p>Review and manage incoming cases</p>
        </div>
      </section>

      <section className="filter-strip">
        {["all", "pending", "reviewed"].map((key) => (
          <button
            key={key}
            className={`filter-chip ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {key.toUpperCase()} ({counts[key]})
          </button>
        ))}
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="submission-list">
        {!error && filtered.length === 0 ? (
          <div className="empty-card">No submissions found.</div>
        ) : (
          filtered.map((item) => (
            <Link
              className="submission-card detailed"
              to={`/app/cases/${item.id}`}
              key={item.id}
            >
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

                  <div className="submission-meta">
                    Age: {item.patient?.profile?.age || "-"} | Gender: {item.patient?.profile?.gender || "-"} | Skin Type: {item.patient?.profile?.skin_type || "-"}
                  </div>
                </div>
              </div>

              <StatusBadge status={item.status} />
            </Link>
          ))
        )}
      </section>
    </div>
  );
}