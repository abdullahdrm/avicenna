import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sessionLogin } from "../lib/api";
import { useAuth } from "../App";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthenticated, setUser } = useAuth();

  const [email, setEmail] = useState("a@gmail.com");
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data = await sessionLogin(email, password);

      if (data?.user?.role !== "doctor") {
        throw new Error("Doctor account required.");
      }

      setAuthenticated(true);
      setUser(data.user);
      navigate(location.state?.from || "/app/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <section className="auth-left blue-hero">
          <div className="pill">Doctor Access</div>
          <h1>Welcome back</h1>
          <p>
            Sign in to review patient cases, inspect analysis results,
            and manage doctor workflows through the Avicenna platform.
          </p>
        </section>

        <section className="auth-right">
          <form className="auth-card" onSubmit={handleSubmit}>
            <h2>Sign In</h2>
            <p>Access your doctor dashboard securely.</p>

            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="a@gmail.com"
              />
            </label>

            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                placeholder="Enter password"
              />
            </label>

            {error ? <div className="error-box">{error}</div> : null}

            <button className="primary-btn full-width" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}