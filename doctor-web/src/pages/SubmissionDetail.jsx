import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";

const API_URL = "http://172.20.10.2:8000/api";

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  async function fetchSubmission() {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/submissions/${id}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setSubmission(data);
    } catch (e) {
      console.error(e);
      setSubmission({});
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading submission...
      </div>
    );
  }

  const patient = submission?.patient;
  const profile = patient?.profile;
  const isReviewed = submission?.status?.toLowerCase() === "reviewed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ChevronLeft size={22} />
        </button>

        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Submission #{id}
        </h1>

        <div className="w-11" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-xl font-bold">Patient Information</h2>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <div className="mt-5 flex items-center gap-4">
          <div className="h-[72px] w-[72px] rounded-full bg-slate-200" />
          <div>
            <p className="text-xl font-bold text-blue-600">
              {patient
                ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
                  patient.username
                : "-"}
            </p>

            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Calendar size={14} />
              <span>
                {submission?.created_at
                  ? new Date(submission.created_at).toLocaleDateString()
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-5 divide-y divide-slate-100">
            <div className="flex justify-between py-4">
              <span className="text-slate-500">Age</span>
              <span className="font-semibold">{profile?.age || "-"}</span>
            </div>
            <div className="flex justify-between py-4">
              <span className="text-slate-500">Gender</span>
              <span className="font-semibold">{profile?.gender || "-"}</span>
            </div>
            <div className="flex justify-between py-4">
              <span className="text-slate-500">Allergies</span>
              <span className="font-semibold">{profile?.allergies || "-"}</span>
            </div>
            <div className="flex justify-between py-4">
              <span className="text-slate-500">Medications</span>
              <span className="font-semibold">{profile?.medications || "-"}</span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Submitted Photo</h2>

        {submission?.photo ? (
          <img
            src={submission.photo}
            alt="Submitted"
            className="mt-4 h-[320px] w-full rounded-2xl object-cover bg-slate-200"
          />
        ) : (
          <div className="mt-4 flex h-[320px] w-full items-center justify-center rounded-2xl bg-slate-200 text-slate-400">
            No image provided
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-bold">Submission Details</h2>

        <div className="divide-y divide-slate-100">
          <div className="flex justify-between py-4">
            <span className="text-slate-500">Place</span>
            <span className="font-semibold">{submission?.place || "-"}</span>
          </div>
          <div className="flex justify-between py-4">
            <span className="text-slate-500">Duration</span>
            <span className="font-semibold">{submission?.duration_days || "-"}</span>
          </div>
          <div className="flex justify-between py-4">
            <span className="text-slate-500">Pain Level</span>
            <span className="font-semibold">
              {submission?.pain_level ? `${submission.pain_level} / 5` : "-"}
            </span>
          </div>
          <div className="py-4">
            <p className="text-slate-500">Patient Comment</p>
            <p className="mt-2 font-semibold text-slate-900">
              {submission?.comment || "-"}
            </p>
          </div>
        </div>
      </section>

      <button className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-bold text-white hover:bg-blue-700">
        {isReviewed ? "View Report" : "Write a Report"}
      </button>
    </div>
  );
}