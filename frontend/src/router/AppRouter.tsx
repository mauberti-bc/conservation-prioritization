import { DialogContextProvider } from 'context/dialogContext';
import { MapContextProvider } from 'context/mapContext';
import { TaskContextProvider } from 'context/taskContext';
import { RequestAccessPage } from 'features/access/RequestAccessPage';
import { HomePage } from 'features/home/HomePage';
import { AuthRedirectGuard } from 'guards/Guards';
import { useAuthContext } from 'hooks/useContext';
import { BaseLayout } from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthRouter } from './AuthRouter';

export const AppRouter = () => {
  return (
    <Routes>
      <Route
        path="/auth/*"
        element={
          <BaseLayout>
            <AuthRouter />
          </BaseLayout>
        }
      />
      <Route
        path="/t/*"
        element={
          <AuthRedirectGuard redirectTo="/auth/login">
            <DialogContextProvider>
              <MapContextProvider>
                <BaseLayout>
                  <TaskContextProvider>
                    <HomePage />
                  </TaskContextProvider>
                </BaseLayout>
              </MapContextProvider>
            </DialogContextProvider>
          </AuthRedirectGuard>
        }
      />

      <Route
        path="/t/request-access"
        element={
          <AuthRedirectGuard redirectTo="/auth/login">
            <BaseLayout>
              <RequestAccessPage />
            </BaseLayout>
          </AuthRedirectGuard>
        }
      />
      <Route path="/" element={<AuthEntryRedirect />} />
      <Route path="*" element={<AuthEntryRedirect />} />
    </Routes>
  );
};

const AuthEntryRedirect = () => {
  const authContext = useAuthContext();

  if (authContext.auth.isLoading) {
    return null;
  }

  return authContext.auth.isAuthenticated ? <Navigate to="/t/" replace /> : <Navigate to="/auth/login" replace />;
};
