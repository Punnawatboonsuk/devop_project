import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// --- Context & Guards ---
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// --- Components ---
import Layout from './components/Layout';

// --- Pages: Auth ---
import Login from './pages/Login';

// --- Pages: Student ---
import StudentDashboard from './pages/student/Dashboard';
import CreateTicket from './pages/student/CreateTicket';
import StudentTracking from './pages/student/Tracking';

// --- Pages: Staff/Executive ---
import StaffDashboard from './pages/staff/StaffDashboard';
import ReviewTicket from './pages/staff/ReviewTicket';
import StaffHistory from './pages/staff/History'; // ✅ เพิ่มบรรทัดนี้ครับ

// --- Pages: Admin ---
import Verification from './pages/admin/Verification';
import VotingControl from './pages/admin/VotingControl';

// --- Pages: Committee ---
import VotingBallot from './pages/committee/VotingBallot';
import Proclamation from './pages/committee/Proclamation';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Toast Notification Position */}
        <Toaster position="top-right" />

        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* ================= STUDENT ROUTES ================= */}
          <Route path="/student" element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <Layout role="STUDENT" />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="create" element={<CreateTicket />} />
            <Route path="tracking" element={<StudentTracking />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ================= STAFF/DEAN ROUTES ================= */}
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={['STAFF', 'SUB_DEAN', 'DEAN']}>
              <Layout role="STAFF" />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="reviews" element={<StaffDashboard />} />
            <Route path="review/:id" element={<ReviewTicket />} />
            <Route path="history" element={<StaffHistory />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ================= ADMIN ROUTES ================= */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout role="ADMIN" />
            </ProtectedRoute>
          }>
            <Route path="verification" element={<Verification />} />
            <Route path="voting" element={<VotingControl />} />
            <Route index element={<Navigate to="verification" replace />} />
          </Route>

          {/* ================= COMMITTEE ROUTES ================= */}
          <Route path="/committee" element={
            <ProtectedRoute allowedRoles={['COMMITTEE', 'PRESIDENT']}>
              <Layout role="COMMITTEE" />
            </ProtectedRoute>
          }>
            <Route path="vote" element={<VotingBallot />} />
            <Route path="dashboard" element={<Navigate to="vote" replace />} />
            <Route index element={<Navigate to="vote" replace />} />
          </Route>

           {/* ================= PRESIDENT ROUTES ================= */}
           {/* ประธานใช้ Layout ของ Committee แต่มีหน้าพิเศษเพิ่ม */}
           <Route path="/president" element={
            <ProtectedRoute allowedRoles={['PRESIDENT']}>
              <Layout role="COMMITTEE" />
            </ProtectedRoute>
          }>
            <Route path="proclaim" element={<Proclamation />} />
          </Route>

          {/* Default Redirect: ถ้าเข้า Path มั่ว ให้ไป Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;