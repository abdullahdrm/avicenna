import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sessionLogin } from "../lib/api";
import { useAuth } from "../App";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthenticated, setUser } = useAuth();

  const [email, setEmail] = useState("doctor@example.com");
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

async function handleSubmit(event) {
  event.preventDefault();
  console.log("submit triggered");
  console.log("email:", email);
  console.log("password:", password);

  setSubmitting(true);
  setError("");

  try {
    const data = await sessionLogin(email, password);
    console.log("login response:", data);

    if (data?.user?.role !== "doctor") {
      throw new Error("Doctor account required.");
    }

    setAuthenticated(true);
    setUser(data.user);
    navigate(location.state?.from || "/app/dashboard", { replace: true });
  } catch (err) {
    console.error("login error:", err);
    setError(err.message || "Login failed.");
  } finally {
    setSubmitting(false);
  }
}

  return (
    <div className="center-screen auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="pill">Doctor access</div>
        <h2>Welcome back</h2>
        <p>Sign in to review patient cases and update diagnoses.</p>

        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>

        {error ? <div className="error-box">{error}</div> : null}

        <button className="primary-btn full-width" type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}