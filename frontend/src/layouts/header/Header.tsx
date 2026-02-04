import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import headerImageLarge from 'assets/images/gov-bc-logo-horiz.png';
import { AuthGuard, UnAuthGuard } from 'guards/Guards';
import { useAuthContext } from 'hooks/useContext';
import { Link as RouterLink } from 'react-router-dom';
import { HeaderAuthenticated } from './authenticated/HeaderAuthenticated';
import { HeaderUnauthenticated } from './unauthenticated/HeaderUnauthenticated';

export const Header = () => {
  const authContext = useAuthContext();
  const isAuthenticated = Boolean(authContext.auth.isAuthenticated);
  const homeLink = isAuthenticated ? '/t/' : '/auth/login';

  return (
    <AppBar
      position="relative"
      elevation={0}
      sx={{
        backgroundColor: '#003366',
        borderBottom: '3px solid #fcba19',
      }}>
      <Toolbar sx={{ minHeight: 70 }}>
        <Box flex="1 1 auto" display="flex" alignItems="center">
          <Box
            sx={{
              '& a': {
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
              },
              '& img': {
                maxHeight: 60,
                mr: 2,
              },
            }}>
            <RouterLink to={homeLink} replace aria-label="Conservation Tool">
              <picture>
                <source srcSet={headerImageLarge} media="(min-width: 960px)" />
                <img src={headerImageLarge} alt="Government of British Columbia" />
              </picture>
            </RouterLink>
          </Box>
          <Typography variant="h1">Conservation Prioritization Tool</Typography>
        </Box>
        <Box flex="0 0 auto">
          <UnAuthGuard>
            <HeaderUnauthenticated />
          </UnAuthGuard>
          <AuthGuard>
            <HeaderAuthenticated />
          </AuthGuard>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
