import { useEffect, useState } from "react";
import { fetchDoctorCases } from "../lib/api";
import { Link } from "react-router-dom";

export default function PendingPage() {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    fetchDoctorCases().then((data) => {
      const allCases = data?.cases || [];
      setCases(allCases.filter((item) => item.status === "pending"));
    });
  }, []);

  return (
    <section className="panel">
      <h3>Pending Reviews</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Patient</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.id}>
                <td><Link to={`/app/cases/${item.id}`}>#{item.id}</Link></td>
                <td>{item.patient?.username || "-"}</td>
                <td>{item.status}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}