import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { ReactNode } from 'react';
import { SIDEBAR_FLOAT_BORDER_RADIUS, SIDEBAR_FLOAT_MARGIN_PX } from './sidebar-layout.constants';

interface FloatingSidebarContainerProps {
  children: ReactNode;
  width: string | Record<string, string | number>;
  maxWidth: string | number | Record<string, string | number>;
  zIndex?: number;
}

/** Floating sidebar shell for map-backed workflows. */
export const FloatingSidebarContainer = ({ children, width, maxWidth, zIndex = 12 }: FloatingSidebarContainerProps) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: SIDEBAR_FLOAT_MARGIN_PX,
        bottom: SIDEBAR_FLOAT_MARGIN_PX,
        left: SIDEBAR_FLOAT_MARGIN_PX,
        width,
        maxWidth,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex,
      }}>
      <Box
        component={Paper}
        elevation={1}
        sx={{
          boxSizing: 'border-box',
          flex: 1,
          minWidth: 0,
          borderRadius: SIDEBAR_FLOAT_BORDER_RADIUS,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 3,
        }}>
        {children}
      </Box>
    </Box>
  );
};
