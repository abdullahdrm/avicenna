const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function setTokens(data) {
  if (data?.access) localStorage.setItem("access_token", data.access);
  if (data?.refresh) localStorage.setItem("refresh_token", data.refresh);
  if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || "Request failed");
  }
  return data;
}

export async function sessionLogin(email, password) {
  const response = await fetch(`${API_BASE}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await handleResponse(response);
  setTokens(data);
  return data;
}

export function logout() {
  clearTokens();
  return { status: "ok" };
}

export function getCurrentUser() {
  const raw = localStorage.getItem("user");
  const token = getAccessToken();

  if (!raw || !token) {
    return { authenticated: false };
  }

  try {
    const user = JSON.parse(raw);
    return { authenticated: true, user };
  } catch {
    return { authenticated: false };
  }
}

export async function fetchDoctorSubmissions(page = 1) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/doctor/submissions/?page=${page}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function fetchPendingReviews(page = 1) {
  const data = await fetchDoctorSubmissions(page);

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : [];

  return items.filter((item) => String(item.status).toLowerCase() === "pending");
}

export async function fetchDoctorDashboard() {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/doctor/dashboard/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function fetchDoctorProfile() {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/doctor/profile/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function fetchDoctorCaseDetail(id) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/doctor/submissions/${id}/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function createSubmissionReport(id, payload) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/submissions/${id}/report/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function approveSubmission(id) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`${API_BASE}/submissions/${id}/approve/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
}

export async function requestReupload(id, reason) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`${API_BASE}/submissions/${id}/reupload/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  return handleResponse(response);
}