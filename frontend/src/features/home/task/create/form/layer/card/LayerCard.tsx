import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { IconMenuButton, IconMenuItem } from 'components/button/IconMenuButton';
import { ReactNode } from 'react';

interface LayerCardProps {
  title: string;
  children: ReactNode;
  menuOptions?: IconMenuItem[];
}

/** Shared layer card shell with a title row and optional actions menu. */
export const LayerCard = ({ title, children, menuOptions = [] }: LayerCardProps) => {
  return (
    <Box
      component={Paper}
      variant="outlined"
      bgcolor="background.default"
      sx={{
        boxShadow: '1px 1px divider',
        px: 2,
        py: 1,
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 1,
      }}>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography fontWeight={700} sx={{ flex: 1, minWidth: 0 }} noWrap>
          {title}
        </Typography>
        {menuOptions.length > 0 && <IconMenuButton items={menuOptions} />}
      </Box>
      {children}
    </Box>
  );
};
