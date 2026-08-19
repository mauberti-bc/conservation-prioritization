import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

interface LayerCardListProps {
  children: ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
}

/** Shared spacing and empty state for selected layer cards. */
export const LayerCardList = ({ children, isEmpty = false, emptyLabel }: LayerCardListProps) => {
  if (isEmpty) {
    return emptyLabel ? <Typography color="text.secondary">{emptyLabel}</Typography> : null;
  }

  return (
    <Stack component="ul" gap={2} sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {children}
    </Stack>
  );
};
