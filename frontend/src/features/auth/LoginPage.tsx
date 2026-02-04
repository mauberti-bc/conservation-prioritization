import { Button, Stack } from '@mui/material';
import { useAuthContext } from 'hooks/useContext';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Login page that triggers OIDC sign-in.
 */
export const LoginPage = () => {
  const authContext = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authContext.auth.isLoading) {
      return;
    }

    if (authContext.auth.isAuthenticated) {
      const nextPath = (location.state as { from?: string } | null)?.from ?? '/t/';
      const safePath = nextPath.startsWith('/auth') ? '/t/' : nextPath;
      window.history.replaceState({}, document.title, location.pathname);
      navigate(safePath, { replace: true });
    }
  }, [authContext.auth.isAuthenticated, authContext.auth.isLoading, location.state, location.pathname, navigate]);

  return (
    <Stack alignItems="center" justifyContent="center" height="100vh">
      <Button
        variant="contained"
        size="large"
        onClick={() => authContext.auth.signinRedirect()}
        sx={{ px: 6, py: 2, fontSize: '1.1rem' }}>
        Login
      </Button>
    </Stack>
  );
};
