import { Box } from '@mui/material';
import { ReactNode } from 'react';
import { LayerSearchSidebar } from './sidebar/LayerSearchSidebar';

interface LayerSearchLayoutProps {
  groupFilters: string[];
  setGroupFilters: (filter: string) => void;
  children: ReactNode;
}

export const LayerSearchLayout = ({ children, groupFilters, setGroupFilters }: LayerSearchLayoutProps) => {
  return (
    <Box display="flex" height="600px">
      <LayerSearchSidebar groupFilters={groupFilters} setGroupFilters={setGroupFilters} />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>{children}</Box>
    </Box>
  );
};
