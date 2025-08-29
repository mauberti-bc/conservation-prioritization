import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import headerImageLarge from 'assets/images/gov-bc-logo-horiz.png';
import { Link as RouterLink } from 'react-router-dom';

export const Header = () => {
  return (
    <AppBar
      position="relative"
      elevation={0}
      sx={{
        backgroundColor: '#003366',
        borderBottom: '3px solid #fcba19',
      }}>
      <Toolbar sx={{ minHeight: 70 }}>
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
          <RouterLink to="/" aria-label="Conservation Tool">
            <picture>
              <source srcSet={headerImageLarge} media="(min-width: 960px)" />
              <img src={headerImageLarge} alt="Government of British Columbia" />
            </picture>
          </RouterLink>
        </Box>
        <Typography variant="h1">Conservation Prioritization Tool</Typography>
      </Toolbar>
    </AppBar>
  );
};
