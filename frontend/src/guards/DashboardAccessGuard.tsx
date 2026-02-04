import { APIError } from 'hooks/useAxios';
import { useConservationApi } from 'hooks/useConservationApi';
import { useAuthContext, useDialogContext } from 'hooks/useContext';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type AccessState = 'unknown' | 'public' | 'restricted';

interface DashboardAccessGuardProps {
  dashboardId: string | null;
  redirectTo?: string;
}

/**
 * Guard that allows unauthenticated access only for public dashboards.
 *
 * @param {PropsWithChildren<DashboardAccessGuardProps>} props
 * @return {*}
 */
export const DashboardAccessGuard = ({
  dashboardId,
  redirectTo,
  children,
}: PropsWithChildren<DashboardAccessGuardProps>) => {
  const authContext = useAuthContext();
  const conservationApi = useConservationApi();
  const location = useLocation();
  const cacheRef = useRef<Map<string, AccessState>>(new Map());
  const dialogContext = useDialogContext();
  const [accessState, setAccessState] = useState<AccessState>('unknown');

  const redirectTarget = redirectTo ?? '/auth/login';

  useEffect(() => {
    if (authContext.auth.isAuthenticated) {
      setAccessState('public');
      return;
    }

    if (!dashboardId) {
      setAccessState('restricted');
      return;
    }

    const cached = cacheRef.current.get(dashboardId);
    if (cached) {
      setAccessState(cached);
      return;
    }

    let isMounted = true;

    const run = async () => {
      try {
        const response = await conservationApi.dashboard.getDashboardAccess(dashboardId);
        const nextState: AccessState = response.access === 'PUBLIC' ? 'public' : 'restricted';

        cacheRef.current.set(dashboardId, nextState);
        if (isMounted) {
          setAccessState(nextState);
        }
      } catch (error) {
        cacheRef.current.set(dashboardId, 'restricted');
        if (isMounted) {
          setAccessState('restricted');
        }
        dialogContext.setSnackbar({ open: true, snackbarMessage: (error as APIError).message });
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [authContext.auth.isAuthenticated, conservationApi.dashboard, dashboardId, dialogContext]);

  if (authContext.auth.isLoading) {
    return null;
  }

  if (authContext.auth.isAuthenticated) {
    return <>{children}</>;
  }

  if (accessState === 'unknown') {
    return null;
  }

  if (accessState === 'public') {
    return <>{children}</>;
  }

  return <Navigate to={redirectTarget} replace state={{ from: location.pathname }} />;
};
