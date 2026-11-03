import { useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';

export const Footer = () => {
  const theme = useTheme();

  return (
    <footer>
      <Box
        component="nav"
        role="navigation"
        aria-label="Footer"
        sx={{
          backgroundColor: theme.palette.primary.dark,
          color: theme.palette.common.white,
          width: '100%',
          minHeight: 43,
          display: 'flex',
          alignItems: 'center',
        }}>
        <Toolbar
          disableGutters
          sx={{
            px: { xs: 2, sm: 4 },
            width: '100%',
            maxWidth: 'lg',
            '& ul': {
              display: 'flex',
              flexWrap: 'wrap',
              gap: theme.spacing(0.5),
              margin: 0,
              padding: 0,
              listStyle: 'none',
              width: '100%',
            },
            '& li + li': {
              paddingLeft: theme.spacing(2),
              marginLeft: theme.spacing(2),
              borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
            },
            '& a': {
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              transition: 'color 0.2s ease',
              '&:hover, &:focus-visible': {
                textDecoration: 'underline',
                outline: 'none',
              },
            },
          }}>
          <ul>
            <li>
              <a href="https://www.gov.bc.ca/gov/content/home/disclaimer" target="_blank" rel="noopener noreferrer">
                Disclaimer
              </a>
            </li>
            <li>
              <a href="https://www.gov.bc.ca/gov/content/home/privacy" target="_blank" rel="noopener noreferrer">
                Privacy
              </a>
            </li>
            <li>
              <a
                href="https://www.gov.bc.ca/gov/content/home/accessible-government"
                target="_blank"
                rel="noopener noreferrer">
                Accessibility
              </a>
            </li>
            <li>
              <a href="https://www.gov.bc.ca/gov/content/home/copyright" target="_blank" rel="noopener noreferrer">
                Copyright
              </a>
            </li>
          </ul>
        </Toolbar>
      </Box>
    </footer>
  );
};
