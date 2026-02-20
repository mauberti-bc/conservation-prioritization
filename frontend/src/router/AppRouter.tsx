import { DialogContextProvider } from 'context/dialogContext';
import { LayerSelectionContextProvider } from 'context/layerSelectionContext';
import { MapContextProvider } from 'context/mapContext';
import { ProjectContextProvider } from 'context/projectContext';
import { SidebarUIContextProvider } from 'context/sidebarUIContext';
import { TaskContextProvider } from 'context/taskContext';
import { RequestAccessPage } from 'features/access/RequestAccessPage';
import { DashboardPage } from 'features/dashboard/DashboardPage';
import { HomePage } from 'features/home/HomePage';
import { TaskPage } from 'features/home/TaskPage';
import { PublicTaskDashboardPage } from 'features/public/PublicTaskDashboardPage';
import { AuthRedirectGuard } from 'guards/Guards';
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
        path="/t/:taskId/dashboard/:dashboardId"
        element={
          <DialogContextProvider>
            <MapContextProvider>
              <BaseLayout>
                <SidebarUIContextProvider>
                  <TaskContextProvider>
                    <ProjectContextProvider>
                      <LayerSelectionContextProvider>
                        <DashboardPage />
                      </LayerSelectionContextProvider>
                    </ProjectContextProvider>
                  </TaskContextProvider>
                </SidebarUIContextProvider>
              </BaseLayout>
            </MapContextProvider>
          </DialogContextProvider>
        }
      />
      <Route path="/t/new" element={<Navigate to="/t/" replace />} />
      <Route
        path="/t/"
        element={
          <AuthRedirectGuard redirectTo="/auth/login">
            <DialogContextProvider>
              <MapContextProvider>
                <BaseLayout>
                  <SidebarUIContextProvider>
                    <ProjectContextProvider>
                      <LayerSelectionContextProvider>
                        <HomePage />
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
        path="/t/:taskId"
        element={
          <AuthRedirectGuard redirectTo="/auth/login">
            <DialogContextProvider>
              <MapContextProvider>
                <BaseLayout>
                  <SidebarUIContextProvider>
                    <TaskContextProvider>
                      <ProjectContextProvider>
                        <LayerSelectionContextProvider>
                          <TaskPage />
                        </LayerSelectionContextProvider>
                      </ProjectContextProvider>
                    </TaskContextProvider>
                  </SidebarUIContextProvider>
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
      <Route path="/" element={<Navigate to="/t/" replace />} />
      <Route path="*" element={<Navigate to="/t/" replace />} />
    </Routes>
  );
};
