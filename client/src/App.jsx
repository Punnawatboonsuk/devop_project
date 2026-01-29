import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
// Import Pages ที่สร้างใหม่
import StudentDashboard from "./pages/student/Dashboard";
import CreateTicket from "./pages/student/CreateTicket";
// import TrackingPage... (ถ้าคุณทำแล้ว)
import StaffDashboard from "./pages/staff/Dashboard";
import ReviewTicket from "./pages/staff/ReviewTicket";
import Verification from "./pages/admin/Verification";
import VotingControl from "./pages/admin/VotingControl";
import VotingBallot from "./pages/committee/VotingBallot";
import Proclamation from "./pages/committee/Proclamation";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />

        {/* --- STUDENT ROUTES --- */}
        <Route path="/student" element={<Layout role="STUDENT" />}>
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="create" element={<CreateTicket />} />
          {/* <Route path="tracking" element={<TrackingPage />} /> */}
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/staff" element={<Layout role="STAFF" />}>
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="reviews" element={<StaffDashboard />} />{" "}
          {/* ใช้หน้าเดียวกับ Dashboard ไปก่อน */}
          <Route path="review/:id" element={<ReviewTicket />} />{" "}
          {/* หน้าดูรายละเอียดแบบ Dynamic ID */}
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/committee" element={<Layout role="COMMITTEE" />}>
          <Route path="dashboard" element={<h1>Committee Dashboard</h1>} />
          <Route path="vote" element={<VotingBallot />} />
          <Route index element={<Navigate to="vote" replace />} />
        </Route>

        <Route path="/president" element={<Layout role="COMMITTEE" />}>
          <Route path="proclaim" element={<Proclamation />} />
        </Route>

        {/* --- ADMIN ROUTES (ทำทีหลัง) --- */}
        <Route path="/admin" element={<Layout role="ADMIN" />}>
          <Route path="dashboard" element={<Verification />} />{" "}
          {/* ให้หน้าแรกเป็น Verification ไปก่อน */}
          <Route path="verification" element={<Verification />} />
          <Route path="voting" element={<VotingControl />} />
          <Route path="reports" element={<h1>Reports Page (Coming Soon)</h1>} />
          <Route index element={<Navigate to="verification" replace />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/student/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
