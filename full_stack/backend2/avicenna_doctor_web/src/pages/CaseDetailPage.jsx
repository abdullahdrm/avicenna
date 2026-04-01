import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchDoctorCaseDetail, reviewDoctorCase } from "../lib/api";

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [confidence, setConfidence] = useState("");
  const [doctorNote, setDoctorNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchDoctorCaseDetail(id)
      .then((data) => {
        setCaseData(data);
        setDiagnosis(data?.diagnosis || "");
        setConfidence(data?.confidence ?? "");
        setDoctorNote(data?.raw_output?.doctor_note || "");
      })
      .catch((e) => setError(e.message || "Failed to load case."));
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const updated = await reviewDoctorCase(id, {
        diagnosis,
        confidence: confidence === "" ? null : Number(confidence),
        doctor_note: doctorNote,
      });
      setCaseData(updated.photo);
      setSuccess("Case updated successfully.");
    } catch (e) {
      setError(e.message || "Update failed.");
    }
  }

  return (
    <div className="page-stack">
      <button className="link-btn back-link" onClick={() => navigate(-1)}>← Back</button>

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      {!caseData ? (
        !error && <div className="panel"><div className="loader" /></div>
      ) : (
        <div className="detail-grid">
          <section className="panel">
            <h3>Case Preview</h3>
            {caseData.image_url ? (
              <img className="detail-image" src={caseData.image_url} alt={`Case ${caseData.id}`} />
            ) : (
              <div className="image-placeholder">No image available</div>
            )}
            <div className="meta-list">
              <div><span>Case ID</span><strong>#{caseData.id}</strong></div>
              <div><span>Patient</span><strong>{caseData.patient?.username || "-"}</strong></div>
              <div><span>Status</span><strong>{caseData.status || "-"}</strong></div>
              <div><span>Created</span><strong>{new Date(caseData.created_at).toLocaleString()}</strong></div>
            </div>
          </section>

          <section className="panel">
            <h3>Doctor Review</h3>
            <form className="review-form" onSubmit={handleSubmit}>
              <label>
                Diagnosis
                <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              </label>

              <label>
                Confidence
                <input
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                />
              </label>

              <label>
                Doctor Note
                <textarea value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)} rows="7" />
              </label>

              <button className="primary-btn" type="submit">Save Review</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
