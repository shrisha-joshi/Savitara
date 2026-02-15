import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PrivateRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // If not logged in, redirect to login page with return url
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is onboarded
  const isOnboarded = user?.onboarded || user?.onboarding_completed;
  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  // If logged in and onboarded, render child routes
  return <Outlet />;
};

export default PrivateRoute;
