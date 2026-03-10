import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import brandIcon from "../assets/android-icon-foreground.png";

const API_URL = "http://127.0.0.1:8000/api";

const STATUS_OPTIONS = ["all", "pending", "reviewed"];
const DATE_OPTIONS = ["all", "today", "week", "month", "year"];

function isWithinRange(dateString, range) {
  if (range === "all") return true;

  const itemDate = new Date(dateString);
  const now = new Date();

  switch (range) {
    case "today":
      return (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    case "week": {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      return itemDate >= d;
    }
    case "month": {
      const d = new Date();
      d.setMonth(now.getMonth() - 1);
      return itemDate >= d;
    }
    case "year": {
      const d = new Date();
      d.setFullYear(now.getFullYear() - 1);
      return itemDate >= d;
    }
    default:
      return true;
  }
}

function StatusBadge({ status }) {
  const reviewed = status === "reviewed";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        reviewed
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {reviewed ? "Reviewed" : "Under Review"}
    </span>
  );
}

export default function DoctorSubmissions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const statusFilter = searchParams.get("filter") || "all";
  const dateFilter = searchParams.get("date") || "all";

  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");

      const res = await fetch(`${API_URL}/doctor/submissions/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results;

      setSubmissions(
        list.map((item) => ({
          id: item.id,
          firstName: item.patient.first_name,
          lastName: item.patient.last_name,
          date: item.created_at,
          status: item.status,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const statusOk = statusFilter === "all" || s.status === statusFilter;
      const dateOk = isWithinRange(s.date, dateFilter);
      return statusOk && dateOk;
    });
  }, [submissions, statusFilter, dateFilter]);

  const counts = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === "pending").length,
    reviewed: submissions.filter((s) => s.status === "reviewed").length,
  };

  function updateStatus(next) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("filter", next);
    setSearchParams(newParams);
  }

  function updateDate(next) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("date", next);
    setSearchParams(newParams);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-sky-500 to-blue-600 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Patient Submissions</h1>
          <p className="mt-2 text-sm text-blue-100">
            Review and manage incoming cases
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3">
          <SlidersHorizontal size={18} />
          <select
            value={dateFilter}
            onChange={(e) => updateDate(e.target.value)}
            className="bg-transparent text-sm font-medium text-white outline-none"
          >
            {DATE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="text-slate-900">
                {opt === "all"
                  ? "All time"
                  : opt === "today"
                  ? "Today"
                  : opt === "week"
                  ? "Last week"
                  : opt === "month"
                  ? "Last month"
                  : "Last year"}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((key) => (
            <button
              key={key}
              onClick={() => updateStatus(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                statusFilter === key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {key.toUpperCase()} ({counts[key]})
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="text-center text-slate-500">Loading submissions...</div>
        ) : filtered.length ? (
          <div className="space-y-3">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/doctor/submission/${item.id}`)}
                className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    item.status === "reviewed"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {item.status === "reviewed" ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Clock size={20} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-900">
                      {item.firstName} {item.lastName}
                    </p>
                    <ChevronRight size={18} className="text-slate-400" />
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <Calendar size={14} />
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-400">
                      No diagnosis yet
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
            <img
              src={brandIcon}
              alt="No submissions"
              className="h-16 w-16 object-contain opacity-90"
            />
            <p className="text-lg font-semibold text-slate-500">
              No submissions found
            </p>
            <p className="max-w-md text-sm text-slate-400">
              There are no cases matching the selected filters right now.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}