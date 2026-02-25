import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import ElderDashboard from "../features/elder/Dashboard";
import CaretakerDashboard from "../features/caretaker/Dashboard";
import MemoryList from "../features/caretaker/MemoryList";
import MemoryForm from "../features/caretaker/MemoryForm";
import ReminderList from "../features/caretaker/ReminderList";
import ActivityLogs from "../features/caretaker/ActivityLogs";
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
          <Route path="memories" element={<MemoryList />} />
          <Route path="memories/new" element={<MemoryForm />} />
          <Route path="memories/:id/edit" element={<MemoryForm />} />
          <Route path="reminders" element={<ReminderList />} />
          <Route path="logs" element={<ActivityLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}