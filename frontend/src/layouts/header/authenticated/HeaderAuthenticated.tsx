import { mdiAccountCircle } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Divider, MenuItem } from '@mui/material';
import { Box } from '@mui/system';
import { useAuthContext } from 'hooks/useContext';

export const HeaderAuthenticated = () => {
  const authContext = useAuthContext();

  return (
    <>
      <Box
        display={{ xs: 'none', lg: 'flex' }}
        alignItems="center"
        sx={{
          fontSize: '16px',
          fontWeight: 700,
        }}>
        <Box
          display="flex"
          alignItems="center"
          sx={{
            padding: '6px 14px',
            lineHeight: '1.75',
          }}>
          <Icon path={mdiAccountCircle} size={1} />
          <Box ml={1}>PLACEHOLDER USERNAME</Box>
        </Box>
        <Divider
          orientation="vertical"
          sx={{
            marginRight: '6px',
            height: '20px',
            borderColor: '#fff',
          }}
        />
        <Button
          component="a"
          variant="text"
          onClick={() => authContext.auth.signoutRedirect()}
          data-testid="menu_log_out"
          sx={{
            color: 'inherit',
            fontSize: '16px',
            fontWeight: 700,
            textTransform: 'none',
          }}>
          Log Out
        </Button>
      </Box>
      <MenuItem
        component="a"
        color="#1a5a96"
        onClick={() => authContext.auth.signoutRedirect()}
        data-testid="collapsed_menu_log_out"
        sx={{
          display: { xs: 'block', lg: 'none' },
        }}>
        Log out
      </MenuItem>
    </>
  );
};
