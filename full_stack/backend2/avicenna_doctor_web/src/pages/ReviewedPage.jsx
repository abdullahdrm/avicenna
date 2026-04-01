import { useEffect, useState } from "react";
import { fetchDoctorCases } from "../lib/api";
import { Link } from "react-router-dom";

export default function ReviewedPage() {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    fetchDoctorCases().then((data) => {
      const allCases = data?.cases || [];
      setCases(allCases.filter((item) => item.status === "reviewed"));
    });
  }, []);

  return (
    <section className="panel">
      <h3>Reviewed Cases</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Patient</th>
              <th>Diagnosis</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.id}>
                <td><Link to={`/app/cases/${item.id}`}>#{item.id}</Link></td>
                <td>{item.patient?.username || "-"}</td>
                <td>{item.diagnosis || "—"}</td>
                <td>{item.confidence ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}