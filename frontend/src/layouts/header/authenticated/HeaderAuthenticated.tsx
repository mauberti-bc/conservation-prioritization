import { mdiAccountCircle, mdiMenu } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useAuthContext } from 'hooks/useContext';
import { MouseEvent, useState } from 'react';

export const HeaderAuthenticated = () => {
  const authContext = useAuthContext();
  const displayName =
    authContext.auth.user?.profile?.name || authContext.auth.user?.profile?.preferred_username || 'User';
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMobileMenuOpen = Boolean(anchorEl);

  const handleOpenMobileMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMobileMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleCloseMobileMenu();

    try {
      await authContext.auth.signoutRedirect();
    } catch (error) {
      console.error('signoutRedirect failed from header', error);
    }
  };

  return (
    <>
      <Box
        display={{ xs: 'none', md: 'flex' }}
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
          <Typography ml={1} fontWeight={700}>
            {displayName}
          </Typography>
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
          onClick={() => {
            void handleLogout();
          }}
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

      <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
        <IconButton
          color="inherit"
          aria-label="Open account menu"
          onClick={handleOpenMobileMenu}
          size="large"
          data-testid="mobile_header_menu_button">
          <Icon path={mdiMenu} size={1} />
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={isMobileMenuOpen}
        onClose={handleCloseMobileMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 240, mt: 1 } }}>
        <Box px={2} py={1.5} display="flex" alignItems="center">
          <Icon path={mdiAccountCircle} size={1} />
          <Typography ml={1} fontWeight={700} noWrap>
            {displayName}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            void handleLogout();
          }}
          data-testid="collapsed_menu_log_out">
          Log out
        </MenuItem>
      </Menu>
    </>
  );
};
