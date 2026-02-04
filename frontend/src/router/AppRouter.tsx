import { DialogContextProvider } from 'context/dialogContext';
import { MapContextProvider } from 'context/mapContext';
import { RequestAccessPage } from 'features/access/RequestAccessPage';
import { HomePage } from 'features/home/HomePage';
import { BaseLayout } from 'layouts/BaseLayout';
import { Route, Routes } from 'react-router-dom';

export const AppRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <DialogContextProvider>
            <MapContextProvider>
              <BaseLayout>
                <HomePage />
              </BaseLayout>
            </MapContextProvider>
          </DialogContextProvider>
        }
      />

      <Route
        path="/request-access"
        element={
          <BaseLayout>
            <RequestAccessPage />
          </BaseLayout>
        }
      />
    </Routes>
  );
};
