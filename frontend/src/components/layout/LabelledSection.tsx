import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

interface LabelledSectionProps {
  label: string;
  children: ReactNode;
}

/**
 * Renders a bold label above a section of content.
 *
 * @param {LabelledSectionProps} props
 * @return {*}
 */
export const LabelledSection = ({ label, children }: LabelledSectionProps) => {
  return (
    <Stack spacing={1}>
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
