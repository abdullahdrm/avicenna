import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="center-screen">
      <div className="panel text-center">
        <h2>Page not found</h2>
        <p className="muted">The page you are looking for does not exist.</p>
        <Link className="primary-btn" to="/">Go home</Link>
      </div>
    </div>
  );
}
