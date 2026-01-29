import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
// Import Pages ที่สร้างใหม่
import StudentDashboard from './pages/student/Dashboard';
import CreateTicket from './pages/student/CreateTicket';
// import TrackingPage... (ถ้าคุณทำแล้ว)

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

        {/* --- ADMIN ROUTES (ทำทีหลัง) --- */}
        <Route path="/admin" element={<Layout role="ADMIN" />}>
           <Route path="dashboard" element={<h1>Admin Dashboard</h1>} />
        </Route>

        <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;