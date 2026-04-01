const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.detail || "Request failed");
  }
  return data;
}

export async function sessionLogin(email, password) {
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function logout() {
  const response = await fetch(`${API_BASE}/auth/logout/`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(response);
}

export async function getCurrentUser() {
  const response = await fetch(`${API_BASE}/auth/me/`, {
    credentials: "include",
  });
  if (response.status === 401) return { authenticated: false };
  return handleResponse(response);
}

export async function fetchDoctorDashboard() {
  const response = await fetch(`${API_BASE}/doctor/dashboard/`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function fetchDoctorCases() {
  const response = await fetch(`${API_BASE}/doctor/cases/`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function fetchDoctorCaseDetail(id) {
  const response = await fetch(`${API_BASE}/doctor/case/${id}/`, {
    credentials: "include",
  });
  return handleResponse(response);
}

export async function reviewDoctorCase(id, payload) {
  const response = await fetch(`${API_BASE}/doctor/review/${id}/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}
