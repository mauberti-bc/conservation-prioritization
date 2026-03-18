import { Button, Stack } from '@mui/material';
import { useAuthContext } from 'hooks/useContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Login page that triggers OIDC sign-in.
 */
export const LoginPage = () => {
  const authContext = useAuthContext();
  const navigate = useNavigate();
  const isLoggedIn =
    authContext.auth.isAuthenticated || Boolean(authContext.auth.user && !authContext.auth.user.expired);

  const handleLogin = async () => {
    try {
      await authContext.auth.signinRedirect();
    } catch (error) {
      console.error('signinRedirect failed on LoginPage', error);
    }
  };

  useEffect(() => {
    if (authContext.auth.isLoading) {
      return;
    }

    if (isLoggedIn) {
      window.history.replaceState({}, document.title, '/');
      navigate('/', { replace: true });
    }
  }, [authContext.auth.isLoading, isLoggedIn, navigate]);

  return (
    <Stack alignItems="center" justifyContent="center" height="100vh">
      <Button
        variant="contained"
        size="large"
        onClick={() => {
          void handleLogin();
        }}
        sx={{ px: 6, py: 2, fontSize: '1.1rem' }}>
        Login
      </Button>
    </Stack>
  );
};
