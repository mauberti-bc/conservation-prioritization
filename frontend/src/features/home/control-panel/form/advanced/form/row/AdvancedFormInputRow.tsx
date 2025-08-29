import { mdiInformationSlabCircleOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TooltipPopover } from 'components/TooltipPopover';
import { ReactNode } from 'react';

interface AdvancedFormInputRowProps {
  label: string;
  tooltip?: string;
  children: ReactNode;
}

export const AdvancedFormInputRow = ({ label, tooltip, children }: AdvancedFormInputRowProps) => {
  return (
    <Stack flexDirection="row" alignItems="center" gap={2} flex="1 1 auto" width="100%">
      <TooltipPopover tooltip={tooltip ?? ''} placement="right">
        <Typography
          color="textSecondary"
          fontWeight={700}
          display="flex"
          alignItems="center"
          sx={{
            cursor: tooltip ? 'pointer' : 'default',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          variant="body2">
          {label}
          {tooltip && (
            <Icon path={mdiInformationSlabCircleOutline} size={0.95} style={{ color: grey[500], marginLeft: 8 }} />
          )}
        </Typography>
      </TooltipPopover>

      <Box ml="auto">{children}</Box>
    </Stack>
  );
};
