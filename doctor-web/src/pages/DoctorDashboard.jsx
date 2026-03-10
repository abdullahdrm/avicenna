import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ClipboardList, FileText, Stethoscope } from "lucide-react";
import splashIcon from "../assets/splash-icon.png";
import iconImage from "../assets/icon.png";

const API_URL = "http://127.0.0.1:8000/api";

function StatCard({ value, label }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-3xl font-bold text-slate-900">{value ?? "-"}</p>
      <p className="mt-2 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const pending = status === "pending";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        pending
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {pending ? "Pending Review" : "Completed"}
    </span>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/doctor/dashboard/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setDashboard(data);
    } catch (error) {
      console.error("Failed to load dashboard", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-500 text-white shadow-sm">
        <div className="grid items-center gap-6 p-6 md:grid-cols-2 md:p-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
              <img
                src={iconImage}
                alt="Avicenna icon"
                className="h-5 w-5 rounded-md object-contain"
              />
              <span>Doctor Workspace</span>
            </div>

            <h1 className="text-3xl font-bold sm:text-4xl">
              Hello Dr. {dashboard?.doctor?.first_name} {dashboard?.doctor?.last_name}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-blue-100 sm:text-base">
              Review patient submissions, manage reports, and keep track of your
              daily workload in one place.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
                <Bell size={20} />
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
              </button>

              <button
                onClick={() => navigate("/doctor/submissions?date=today&filter=all")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                View Today&apos;s Cases
              </button>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/20 blur-3xl" />
              <img
                src={splashIcon}
                alt="Avicenna visual"
                className="relative h-56 w-56 object-contain drop-shadow-2xl sm:h-72 sm:w-72"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          value={dashboard?.stats?.pending_submissions}
          label="Pending Submissions"
        />
        <StatCard
          value={dashboard?.stats?.completed_submissions}
          label="Completed Reviews"
        />
        <StatCard
          value={dashboard?.stats?.patients_count}
          label="Patients"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Quick Actions</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => navigate("/doctor/submissions?date=today&filter=all")}
            className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-3xl bg-blue-600 p-6 text-white shadow-sm transition hover:bg-blue-700"
          >
            <ClipboardList size={28} />
            <span className="font-semibold">Today&apos;s Submissions</span>
          </button>

          <button
            onClick={() => navigate("/doctor/submissions?date=all&filter=pending")}
            className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-6 text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FileText size={28} />
            <span className="font-semibold">Pending Submissions</span>
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Latest Submission</h2>
          <button
            onClick={() => navigate("/doctor/submissions?date=all&filter=all")}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View All
          </button>
        </div>

        {!dashboard?.recent_cases?.length ? (
          <p className="text-slate-500">No recent submissions</p>
        ) : (
          <div className="space-y-3">
            {dashboard.recent_cases.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/doctor/submission/${item.id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Stethoscope size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.patient_name}
                    </p>
                  </div>
                </div>

                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}