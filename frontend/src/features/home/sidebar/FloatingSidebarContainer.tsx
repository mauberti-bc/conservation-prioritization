import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { ReactNode } from 'react';
import {
  SIDEBAR_FLOAT_BORDER_RADIUS,
  SIDEBAR_FLOAT_MARGIN_PX,
  SIDEBAR_FLOAT_MIN_WIDTH,
  SIDEBAR_FLOAT_WIDTH,
} from './sidebar-layout.constants';

interface FloatingSidebarContainerProps {
  children: ReactNode;
  zIndex?: number;
}

/**
 * Floating sidebar shell for map-backed workflows.
 *
 * @param {FloatingSidebarContainerProps} props
 * @returns {JSX.Element}
 */
export const FloatingSidebarContainer = ({ children, zIndex = 12 }: FloatingSidebarContainerProps) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: SIDEBAR_FLOAT_MARGIN_PX,
        bottom: SIDEBAR_FLOAT_MARGIN_PX,
        left: SIDEBAR_FLOAT_MARGIN_PX,
        width: SIDEBAR_FLOAT_WIDTH,
        maxWidth: `calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px)`,
        minWidth: `min(${SIDEBAR_FLOAT_MIN_WIDTH}px, calc(100vw - ${SIDEBAR_FLOAT_MARGIN_PX * 2}px))`,
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
