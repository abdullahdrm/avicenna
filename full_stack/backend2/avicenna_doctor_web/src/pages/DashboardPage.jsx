import { useEffect, useState } from "react";
import { fetchDoctorDashboard } from "../lib/api";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDoctorDashboard()
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load dashboard."));
  }, []);

  const cards = [
    { label: "Total Cases", value: data?.total_cases ?? "-" },
    { label: "Pending Review", value: data?.pending_cases ?? "-" },
    { label: "Reviewed Cases", value: data?.reviewed_cases ?? "-" },
  ];

  return (
    <div className="page-stack">
      <section className="card-grid">
        {cards.map((card) => (
          <article className="stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Recent Cases</h3>
          <Link className="link-btn" to="/app/cases">See all</Link>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        {!error && !data?.cases?.length ? (
          <p className="muted">No cases available yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Diagnosis</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.cases || []).slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td><Link to={`/app/cases/${item.id}`}>#{item.id}</Link></td>
                    <td>{item.patient?.username || "-"}</td>
                    <td><span className="badge">{item.status || "-"}</span></td>
                    <td>{item.diagnosis || "—"}</td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
