import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Mock Pages (สร้างหน้าเปล่าๆ ไว้ทดสอบก่อน)
const Dashboard = () => <h1 className="text-3xl font-bold text-ku-main">Student Dashboard</h1>;
const Tracking = () => <div className="p-6 bg-white rounded-xl shadow"><h2 className="text-xl mb-4">Status Tracking</h2><StatusTimeline currentStatus="dev_review" /></div>;
// import StatusTimeline ต้อง import มาด้วยนะถ้าจะใช้

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* หน้า Login (แยก Layout) */}
        <Route path="/login" element={<div>Login Page</div>} />

        {/* Student Routes */}
        <Route path="/student" element={<Layout role="STUDENT" />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tracking" element={<Tracking />} />
          {/* Redirect default path */}
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<Layout role="ADMIN" />}>
          <Route path="dashboard" element={<h1>Admin Dashboard</h1>} />
        </Route>
        
        {/* Default Redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;