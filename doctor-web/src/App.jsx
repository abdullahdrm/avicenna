import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DoctorLayout from "./layout/DoctorLayout";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorSubmissions from "./pages/DoctorSubmissions";
import DoctorProfile from "./pages/DoctorProfile";
import SubmissionDetail from "./pages/SubmissionDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/doctor" replace />} />

        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index element={<DoctorDashboard />} />
          <Route path="submissions" element={<DoctorSubmissions />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="submission/:id" element={<SubmissionDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}