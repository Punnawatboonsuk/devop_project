import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // ถ้าสิทธิ์ไม่ถึง ให้ส่งกลับไปหน้า Dashboard ของตัวเอง
    return <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />;
  }

  return children;
};

export default ProtectedRoute;