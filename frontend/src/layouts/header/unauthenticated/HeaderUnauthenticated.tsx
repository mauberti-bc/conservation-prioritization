import { mdiLoginVariant } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import { useAuthContext } from 'hooks/useContext';

export const HeaderUnauthenticated = () => {
  const authContext = useAuthContext();

  return (
    <Button
      component="a"
      color="inherit"
      variant="text"
      onClick={() => authContext.auth.signinRedirect()}
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
