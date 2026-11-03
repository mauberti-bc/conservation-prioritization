import { mdiInformationSlabCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box, { BoxProps } from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import { TooltipPopover } from 'components/TooltipPopover';

interface TooltipStackProps extends BoxProps {
  tooltip: string;
  children: React.ReactNode;
  gap?: number;
  flexChildren?: boolean;
}

export const TooltipStack = ({ tooltip, children, gap = 1, flexChildren, ...boxProps }: TooltipStackProps) => {
  return (
    <TooltipPopover tooltip={tooltip} placement="right">
      <Box
        display={flexChildren ? 'flex' : 'inline-flex'}
        alignItems="center"
        gap={gap}
        width={flexChildren ? '100%' : 'fit-content'}
        sx={{ cursor: 'pointer' }}
        {...boxProps}>
        <Box display="flex" alignItems="center" flex={flexChildren ? 1 : undefined}>
          {children}
        </Box>

        <Box display="flex" alignItems="center" flexShrink={0}>
          <Icon path={mdiInformationSlabCircleOutline} size={0.8} color={grey[500]} />
        </Box>
      </Box>
    </TooltipPopover>
  );
};
