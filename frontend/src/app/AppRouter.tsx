import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import ElderDashboard from "../features/elder/Dashboard";
import CaretakerDashboard from "../features/caretaker/Dashboard";
import ElderLayout from "./layouts/ElderLayout";
import CaretakerLayout from "./layouts/CaretakerLayout";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Elder Routes */}
        <Route path="/elder" element={<ElderLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ElderDashboard />} />
        </Route>

        {/* Caretaker Routes */}
        <Route path="/caretaker" element={<CaretakerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CaretakerDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}