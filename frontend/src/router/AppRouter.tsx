import { DialogContextProvider } from 'context/dialogContext';
import { LayerSelectionContextProvider } from 'context/layerSelectionContext';
import { MapContextProvider } from 'context/mapContext';
import { ProjectContextProvider } from 'context/projectContext';
import { SidebarUIContextProvider } from 'context/sidebarUIContext';
import { RequestAccessPage } from 'features/access/RequestAccessPage';
import { MapPage } from 'features/home/map/MapPage';
import { PublicTaskDashboardPage } from 'features/public/PublicTaskDashboardPage';
import { AuthRedirectGuard } from 'guards/Guards';
import { useAuthContext } from 'hooks/useContext';
import { BaseLayout } from 'layouts/BaseLayout';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthRouter } from './AuthRouter';

const RootRoute = () => {
  const authContext = useAuthContext();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const hasOidcCallbackParams = params.has('code') && params.has('state');
  const isLoggedIn =
    authContext.auth.isAuthenticated || Boolean(authContext.auth.user && !authContext.auth.user.expired);

  if (hasOidcCallbackParams) {
    if (authContext.auth.isLoading || authContext.auth.activeNavigator === 'signinRedirect') {
      return null;
    }

    if (isLoggedIn) {
      return <Navigate to="/map" replace />;
    }

    return <Navigate to="/auth/login" replace />;
  }

  return <Navigate to="/map" replace />;
};

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
        path="/map/*"
        element={
          <AuthRedirectGuard redirectTo="/auth/login">
            <DialogContextProvider>
              <MapContextProvider>
                <BaseLayout>
                  <SidebarUIContextProvider>
                    <ProjectContextProvider>
                      <LayerSelectionContextProvider>
                        <MapPage />
                      </LayerSelectionContextProvider>
                    </ProjectContextProvider>
                  </SidebarUIContextProvider>
                </BaseLayout>
              </MapContextProvider>
            </DialogContextProvider>
          </AuthRedirectGuard>
        }
      />
      <Route
        path="/request-access"
        element={
          <AuthRedirectGuard redirectTo="/auth/login">
            <BaseLayout>
              <RequestAccessPage />
            </BaseLayout>
          </AuthRedirectGuard>
        }
      />
      <Route
        path="/p/:dashboardId"
        element={
          <MapContextProvider>
            <BaseLayout>
              <PublicTaskDashboardPage />
            </BaseLayout>
          </MapContextProvider>
        }
      />
      <Route path="/" element={<RootRoute />} />
      <Route path="/t/*" element={<Navigate to="/map" replace />} />
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
};
