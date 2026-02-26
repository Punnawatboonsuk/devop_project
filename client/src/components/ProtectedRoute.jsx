import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const roleFallbackRoutes = {
  STUDENT: '/student/dashboard',
  STAFF: '/staff/dashboard',
  SUB_DEAN: '/staff/dashboard',
  DEAN: '/staff/dashboard',
  ADMIN: '/admin/verification',
  COMMITTEE: '/committee/dashboard',
  COMMITTEE_PRESIDENT: '/president/proclaim',
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    user.primary_role === 'STUDENT' &&
    user.needs_profile_completion &&
    location.pathname !== '/auth/sso-setup'
  ) {
    return <Navigate to="/auth/sso-setup" replace />;
  }

  if (!allowedRoles.includes(user.primary_role)) {
    return <Navigate to={roleFallbackRoutes[user.primary_role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;

// // 2. ถ้าเข้าสู่ระบบแล้ว แต่ Role ไม่ตรงกับหน้าที่อนุญาต (✅ เปลี่ยนมาใช้ user.role)
//   if (!allowedRoles.includes(user.role)) {
    
//     // กำหนด Path ปลายทางที่ถูกต้องสำหรับแต่ละ Role เวลาเด้งกลับ
//     let redirectPath = '/login';
//     if (user.role === 'STUDENT') {
//       redirectPath = '/student/dashboard';
//     } else if (['STAFF', 'SUB_DEAN', 'DEAN'].includes(user.role)) {
//       redirectPath = '/staff/dashboard'; // สายคณะใช้ Path /staff ทั้งหมด
//     } else if (user.role === 'ADMIN') {
//       redirectPath = '/admin/verification';
//     } else if (['COMMITTEE', 'PRESIDENT'].includes(user.role)) {
//       redirectPath = '/committee/vote';
//     }

//     // เด้งกลับไปหน้า Dashboard ของ Role ตัวเอง
//     return <Navigate to={redirectPath} replace />;