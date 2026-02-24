import { Navigate, useLocation } from 'react-router-dom';
// ตรวจสอบว่า import useAuth มาจากไฟล์ที่ถูกต้อง
import { useAuth } from '../context/AuthContext'; 

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  // 1. ถ้ายังไม่ได้ Login ให้เด้งไปหน้า Login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. ถ้าเข้าสู่ระบบแล้ว แต่ Role ไม่ตรงกับหน้าที่อนุญาต (✅ เปลี่ยนมาใช้ user.role)
  if (!allowedRoles.includes(user.role)) {
    
    // กำหนด Path ปลายทางที่ถูกต้องสำหรับแต่ละ Role เวลาเด้งกลับ
    let redirectPath = '/login';
    if (user.role === 'STUDENT') {
      redirectPath = '/student/dashboard';
    } else if (['STAFF', 'SUB_DEAN', 'DEAN'].includes(user.role)) {
      redirectPath = '/staff/dashboard'; // สายคณะใช้ Path /staff ทั้งหมด
    } else if (user.role === 'ADMIN') {
      redirectPath = '/admin/verification';
    } else if (['COMMITTEE', 'PRESIDENT'].includes(user.role)) {
      redirectPath = '/committee/vote';
    }

    // เด้งกลับไปหน้า Dashboard ของ Role ตัวเอง
    return <Navigate to={redirectPath} replace />;
  }

  // 3. ถ้า Role ถูกต้อง ก็ให้แสดงผลหน้าเว็บได้ตามปกติ
  return children;
};

export default ProtectedRoute;