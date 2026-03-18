import { useAuthContext } from 'hooks/useContext';
import { LoginPage } from 'features/auth/LoginPage';
import { LogoutPage } from 'features/auth/LogoutPage';
import { Navigate, Route, Routes } from 'react-router-dom';

/**
 * Router for authentication-related routes under /auth.
 */
export const AuthRouter = () => {
  const authContext = useAuthContext();
  const isLoggedIn =
    authContext.auth.isAuthenticated || Boolean(authContext.auth.user && !authContext.auth.user.expired);

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="logout" element={<LogoutPage />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
};
