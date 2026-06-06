import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import DashboardLayout from "@/pages/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Teachers from "@/pages/Teachers";
import Classes from "@/pages/Classes";
import Students from "@/pages/Students";
import StudentProfile from "@/pages/StudentProfile";
import Attendance from "@/pages/Attendance";
import Exams from "@/pages/Exams";
import Fees from "@/pages/Fees";
import Circulars from "@/pages/Circulars";
import AITeacher from "@/pages/AITeacher";
import AIParent from "@/pages/AIParent";
import AIInsights from "@/pages/AIInsights";
import Timetable from "@/pages/Timetable";
import Communication from "@/pages/Communication";
import Certificates from "@/pages/Certificates";
import HelpMe from "@/pages/HelpMe";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="classes" element={<Classes />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="exams" element={<Exams />} />
        <Route path="fees" element={<Fees />} />
        <Route path="circulars" element={<Circulars />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="communication" element={<Communication />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="help" element={<HelpMe />} />
        <Route path="ai/teacher" element={<AITeacher />} />
        <Route path="ai/parent" element={<AIParent />} />
        <Route path="ai/insights" element={<AIInsights />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
