import { useEffect, useState } from "react";
import { LogOut, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import appIcon from "../assets/icon.png";

const API_URL = "http://127.0.0.1:8000/api";

function Stat({ value, label }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs font-bold tracking-wide text-blue-100">
        {label}
      </p>
    </div>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-4 ${
        last ? "" : "border-b border-slate-100"
      }`}
    >
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">
        {value ?? "-"}
      </span>
    </div>
  );
}

function EditProfileModal({
  open,
  onClose,
  allowedDays,
  maxSubmissionsPerDay,
  onSaved,
}) {
  const [newAllowedDays, setNewAllowedDays] = useState("");
  const [newMaxSubmission, setNewMaxSubmission] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNewAllowedDays(
      Array.isArray(allowedDays) ? allowedDays.join(", ") : allowedDays || ""
    );
    setNewMaxSubmission(String(maxSubmissionsPerDay ?? ""));
  }, [allowedDays, maxSubmissionsPerDay]);

  async function saveChanges() {
    if (!newAllowedDays || !newMaxSubmission) {
      alert("Both fields are required");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("access_token");

      const normalizedDays = newAllowedDays
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      const res = await fetch(`${API_URL}/doctor/profile/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowed_days: normalizedDays,
          max_submissions_per_day: Number(newMaxSubmission),
        }),
      });

      if (!res.ok) throw new Error("Update failed");

      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">Edit Profile</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mb-2 block text-sm text-slate-500">Allowed Days</label>
        <input
          value={newAllowedDays}
          onChange={(e) => setNewAllowedDays(e.target.value)}
          placeholder="mon, tue, wed"
          className="mb-4 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
        />

        <label className="mb-2 block text-sm text-slate-500">
          Max Submission / Day
        </label>
        <input
          value={newMaxSubmission}
          onChange={(e) => setNewMaxSubmission(e.target.value)}
          placeholder="10"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DoctorProfile() {
  const navigate = useNavigate();
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");

      const res = await fetch(`${API_URL}/doctor/profile/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Fetch failed");

      const data = await res.json();
      setDoctorInfo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatDays(days) {
    if (!days || days.length === 0) return "-";

    const map = {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
    };

    return days.map((d) => map[d] ?? d).join(" – ");
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-gradient-to-br from-sky-500 to-blue-600 p-6 text-white shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white/15 p-3">
            <img
              src={appIcon}
              alt="Doctor avatar"
              className="h-full w-full object-contain"
            />
          </div>

          <div>
            <h1 className="text-3xl font-bold">
              {doctorInfo?.user?.first_name} {doctorInfo?.user?.last_name}
            </h1>
            <p className="mt-1 text-blue-100">{doctorInfo?.user?.email}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat value={doctorInfo?.stats?.patients_count ?? 0} label="PATIENTS" />
          <Stat
            value={doctorInfo?.stats?.submissions_reviewed ?? 0}
            label="REVIEWED"
          />
          <Stat value={doctorInfo?.stats?.active_days ?? 0} label="DAYS" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-xl font-bold">Professional Details</h2>
        <InfoRow
          label="Experience"
          value={`${doctorInfo?.experience_years ?? "-"} years`}
        />
        <InfoRow label="City" value={doctorInfo?.city} />
        <InfoRow label="Hospital" value={doctorInfo?.hospital} last />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold">Preferences</h2>
          <button
            onClick={() => setEditOpen(true)}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        </div>

        <InfoRow label="Allowed Days" value={formatDays(doctorInfo?.allowed_days)} />
        <InfoRow
          label="Max / Day"
          value={doctorInfo?.max_submissions_per_day}
          last
        />
      </section>

      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 font-bold text-red-600"
      >
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>

      <p className="text-center text-xs text-slate-400">Version 1.0.0</p>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        allowedDays={doctorInfo?.allowed_days}
        maxSubmissionsPerDay={doctorInfo?.max_submissions_per_day}
        onSaved={fetchProfile}
      />
    </div>
  );
}