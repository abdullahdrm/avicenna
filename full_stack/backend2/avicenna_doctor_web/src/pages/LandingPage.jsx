import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing">
      <section className="hero-card">
        <div className="pill">Integrated with Django backend</div>
        <h1>Avicenna</h1>
        <p className="hero-subtitle">
          A clean web experience for doctors to review uploaded skin images,
          inspect AI results, and manage case flow.
        </p>
        <div className="hero-actions">
          <Link className="primary-btn" to="/login">Doctor Login</Link>
          <a className="secondary-btn" href="/api/health/" target="_blank" rel="noreferrer">API Health</a>
        </div>
      </section>

      <section className="feature-grid">
        <article className="panel">
          <h3>Case Dashboard</h3>
          <p>Track reviewed, pending, and recent cases with summary cards and a focused workflow.</p>
        </article>
        <article className="panel">
          <h3>Case Details</h3>
          <p>Open image previews, patient info, AI predictions, and doctor notes in a single view.</p>
        </article>
        <article className="panel">
          <h3>Real Links</h3>
          <p>Navigation, login, dashboard routing, and backend API calls are wired for real usage.</p>
        </article>
      </section>
    </div>
  );
}
