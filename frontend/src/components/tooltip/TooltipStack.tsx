import { mdiInformationSlabCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Stack, { StackProps } from '@mui/material/Stack';
import { TooltipPopover } from 'components/TooltipPopover';
import { ReactNode } from 'react';

interface TooltipStackProps extends StackProps {
  tooltip: string;
  children: ReactNode;
}

export const TooltipStack = ({ tooltip, children, ...stackProps }: TooltipStackProps) => {
  return (
    <Stack direction="row" alignItems="center" gap={1} width="100%" {...stackProps}>
      <TooltipPopover tooltip={tooltip} placement="right">
        <Box display="flex" sx={{ cursor: 'pointer' }}>
          <Box mt={0.25}>{children}</Box>

          <Box ml={1}>
            <Icon path={mdiInformationSlabCircleOutline} size={1} color={grey[500]} />
          </Box>
        </Box>
      </TooltipPopover>
    </Stack>
  );
};
