import { mdiLoginVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { useAuthContext } from 'hooks/useContext';

export const HeaderUnauthenticated = () => {
  const authContext = useAuthContext();

  const handleLogin = async () => {
    try {
      await authContext.auth.signinRedirect();
    } catch (error) {
      console.error('signinRedirect failed from header', error);
    }
  };

  return (
    <Button
      component="a"
      color="inherit"
      variant="text"
      onClick={() => {
        void handleLogin();
      }}
      disableElevation
      startIcon={<Icon path={mdiLoginVariant} size={1} />}
      data-testid="menu_log_in"
      sx={{
        p: 1,
        fontSize: '16px',
        fontWeight: 700,
        textTransform: 'none',
      }}>
      Log In
    </Button>
  );
};
