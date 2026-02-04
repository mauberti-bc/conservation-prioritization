import { Box } from '@mui/material';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import { ReactNode } from 'react';
import { LayerSearchSidebar } from './sidebar/LayerSearchSidebar';

interface LayerSearchLayoutProps {
  availableLayers: TaskLayerOption[];
  groupFilters: string[];
  setGroupFilters: (filter: string) => void;
  children: ReactNode;
}

export const LayerSearchLayout = ({
  children,
  availableLayers,
  groupFilters,
  setGroupFilters,
}: LayerSearchLayoutProps) => {
  return (
    <Box display="flex" height="600px">
      <LayerSearchSidebar
        availableLayers={availableLayers}
        groupFilters={groupFilters}
        setGroupFilters={setGroupFilters}
      />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>{children}</Box>
    </Box>
  );
};
