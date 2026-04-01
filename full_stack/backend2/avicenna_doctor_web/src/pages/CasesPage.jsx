import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDoctorCases } from "../lib/api";

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDoctorCases()
      .then((data) => setCases(data?.cases || data || []))
      .catch((e) => setError(e.message || "Failed to load cases."));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) =>
      String(item.id).includes(q) ||
      (item.patient?.username || "").toLowerCase().includes(q) ||
      (item.diagnosis || "").toLowerCase().includes(q) ||
      (item.status || "").toLowerCase().includes(q)
    );
  }, [cases, query]);

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>All Cases</h3>
          <input
            className="search-input"
            placeholder="Search case, patient, diagnosis..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Patient</th>
                <th>Status</th>
                <th>AI / Final Diagnosis</th>
                <th>Confidence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td><Link to={`/app/cases/${item.id}`}>#{item.id}</Link></td>
                  <td>{item.patient?.username || "-"}</td>
                  <td><span className="badge">{item.status || "-"}</span></td>
                  <td>{item.diagnosis || "—"}</td>
                  <td>{item.confidence ?? "—"}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!error && filtered.length === 0 ? <p className="muted">No matching cases.</p> : null}
      </section>
    </div>
  );
}
