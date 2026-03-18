import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PropsWithChildren } from 'react';

interface LabelledSectionProps extends PropsWithChildren {
  label?: string;
}

/**
 * Renders a bold label above a section of content.
 *
 * @param {LabelledSectionProps} props
 * @return {*}
 */
export const LabelledSection = ({ label, children }: LabelledSectionProps) => {
  return (
    <Stack spacing={2}>
      <Typography
        fontWeight={700}
        display="flex"
        alignItems="center"
        sx={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
};
