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
      <Box display="flex" alignItems="center" gap={gap} width="100%" sx={{ cursor: 'pointer' }} {...boxProps}>
        <Box flex={flexChildren ? 1 : undefined}>{children}</Box>

        <Box flexShrink={0}>
          <Icon path={mdiInformationSlabCircleOutline} size={1} color={grey[500]} />
        </Box>
      </Box>
    </TooltipPopover>
  );
};
