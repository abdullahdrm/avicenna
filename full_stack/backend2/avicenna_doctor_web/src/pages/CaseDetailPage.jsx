import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchDoctorCaseDetail, createSubmissionReport, approveSubmission, requestReupload } from "../lib/api";

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  let label = "Under Review";
  if (normalized === "reviewed") label = "Reviewed";
  if (normalized === "approved") label = "Approved";
  if (normalized === "reupload_requested") label = "Reupload Requested";

  return (
    <span className={`status-badge ${normalized || "pending"}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value, last = false }) {
  return (
    <div className={`info-row ${last ? "last" : ""}`}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatLabel(text) {
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [reportText, setReportText] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReupload, setShowReupload] = useState(false);
  const [reuploadReason, setReuploadReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchDoctorCaseDetail(id)
      .then((data) => {
        setCaseData(data);
        setDiagnosis(data?.skin_analysis?.prediction || "");
      })
      .catch((e) => setError(e.message || "Failed to load case."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await createSubmissionReport(id, {
        diagnosis,
        content: reportText,
      });
      setSuccess("Report created successfully.");
    } catch (e) {
      setError(e.message || "Failed to create report.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
  setError("");
  setSuccess("");
  setActionLoading(true);

  try {
    await approveSubmission(id);
    setSuccess("Submission approved successfully.");
    setCaseData((prev) => ({ ...prev, status: "approved" }));
  } catch (e) {
    setError(e.message || "Approval failed.");
  } finally {
    setActionLoading(false);
  }
}

async function handleRequestReupload() {
  setError("");
  setSuccess("");

  if (!reuploadReason.trim()) {
    setError("Please write a reason for reupload request.");
    return;
  }

  setActionLoading(true);

  try {
    await requestReupload(id, reuploadReason);
    setSuccess("Reupload request sent successfully.");
    setCaseData((prev) => ({ ...prev, status: "reupload_requested" }));
    setShowReupload(false);
    setReuploadReason("");
  } catch (e) {
    setError(e.message || "Reupload request failed.");
  } finally {
    setActionLoading(false);
  }
}

  if (loading) {
    return (
      <div className="center-screen" style={{ minHeight: "50vh" }}>
        <div className="loader" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="dashboard-page">
        <button className="back-link" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="empty-card">Case not found.</div>
      </div>
    );
  }

  

  const patient = caseData.patient || {};
  const profile = patient.profile || {};
  const analysis = caseData.skin_analysis || {};
  const timeline = caseData.timeline || [];

  return (
    <div className="dashboard-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      <section className="blue-hero compact">
        <div>
          <h1>Submission Details</h1>
          <p>Review selected patient update and create report</p>
        </div>
      </section>

      <section className="white-card">
        <div className="section-head">
          <h3>Patient Information</h3>
          <StatusBadge status={caseData.status} />
        </div>

        <div className="patient-summary">
          <div className="avatar-circle small-avatar" />
          <div>
            <div className="submission-name">
              {patient.first_name || "Patient"} {patient.last_name || ""}
            </div>
            <div className="submission-date">
              Joined: {profile.date_joined ? new Date(profile.date_joined).toLocaleDateString() : "-"}
            </div>
          </div>
        </div>

        <div className="meta-list compact-meta">
          <div>
            <span>Age</span>
            <strong>{profile.age || "-"}</strong>
          </div>
          <div>
            <span>Gender</span>
            <strong>{profile.gender || "-"}</strong>
          </div>
          <div>
            <span>Skin Type</span>
            <strong>{profile.skin_type || "-"}</strong>
          </div>
          <div>
            <span>Allergies</span>
            <strong>{profile.allergies || "-"}</strong>
          </div>
          <div>
            <span>Medications</span>
            <strong>{profile.medications || "-"}</strong>
          </div>
          <div>
            <span>Medical Conditions</span>
            <strong>{profile.medical_conditions || "-"}</strong>
          </div>
        </div>
      </section>

      <section className="white-card">
        <h3>Reviewing Selected Update</h3>

        {analysis.image ? (
          <img
            className="detail-image"
            src={analysis.image}
            alt={`Submission ${caseData.id}`}
          />
        ) : (
          <div className="image-placeholder">No image available</div>
        )}
      </section>

      <section className="white-card">
        <h3>Clinical Details</h3>
        <InfoRow label="Prediction" value={analysis.prediction} />
        <InfoRow label="Confidence" value={analysis.confidence ?? "-"} />
        <InfoRow label="Body Part" value={analysis.body_part} />
        <InfoRow label="Pain Level" value={analysis.pain_level ?? "-"} />
        <InfoRow label="Duration" value={analysis.duration || "-"} />
        <InfoRow label="Created" value={analysis.formatted_date || "-"} last />
      </section>

      {analysis.comments ? (
        <section className="white-card">
          <h3>Patient Comment</h3>
          <p className="soft-text">{analysis.comments}</p>
        </section>
      ) : null}

      {analysis.answers && Object.keys(analysis.answers).length > 0 ? (
        <section className="white-card">
          <h3>Specific Symptoms</h3>
          <div className="meta-list compact-meta">
            {Object.entries(analysis.answers).map(([key, value]) => (
              <div key={key}>
                <span>{formatLabel(key)}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {timeline.length > 0 ? (
        <section className="white-card">
          <div className="section-head">
            <h3>Progress Timeline</h3>
          </div>

          <div className="submission-list">
            {timeline.map((item) => (
              <div className="submission-card detailed" key={item.id}>
                <div className="submission-left">
                  <div className={`round-icon ${item.has_report ? "green" : "orange"}`}>
                    {item.has_report ? "✓" : "⏳"}
                  </div>
                  <div>
                    <div className="submission-name">{item.date}</div>
                    <div className="submission-date">{item.body_part || "-"}</div>
                    <div className="submission-meta">
                      {item.prediction || "No prediction"}
                    </div>
                  </div>
                </div>

                <span className={`status-badge ${item.has_report ? "reviewed" : "pending"}`}>
                  {item.has_report ? "Reported" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="white-card">
        <h3>Doctor Response</h3>
      <section className="white-card">
        <h3>Final Actions</h3>

        <div className="action-row">
          <button
            className="primary-btn"
            type="button"
            onClick={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? "Processing..." : "Approve Report"}
          </button>

          <button
            className="ghost-btn"
            type="button"
            onClick={() => setShowReupload((prev) => !prev)}
            disabled={actionLoading}
          >
            Request Reupload
          </button>
        </div>

        {showReupload ? (
          <div className="reupload-box">
            <label>
              Reupload Reason
              <textarea
                value={reuploadReason}
                onChange={(e) => setReuploadReason(e.target.value)}
                rows="5"
                placeholder="Explain why the patient should upload a new photo..."
              />
            </label>

            <button
              className="primary-btn"
              type="button"
              onClick={handleRequestReupload}
              disabled={actionLoading}
            >
              Send Reupload Request
            </button>
          </div>
        ) : null}
      </section>
        <form className="review-form" onSubmit={handleSubmit}>
          <label>
            Diagnosis
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Enter diagnosis"
            />
          </label>

          <label>
            Report / Doctor Note
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows="8"
              placeholder="Write your report here..."
            />
          </label>

          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create Report"}
          </button>
        </form>
      </section>
    </div>
  );
}