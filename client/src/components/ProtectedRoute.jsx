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
