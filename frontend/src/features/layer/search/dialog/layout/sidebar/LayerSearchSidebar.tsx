import { Box, List, ListItemButton, ListItemText } from '@mui/material';
import { grey } from '@mui/material/colors';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';

interface ILayerSearchSidebarProps {
  availableLayers: TaskLayerOption[];
  groupFilters: string[];
  setGroupFilters: (filter: string) => void;
}

export const LayerSearchSidebar = (props: ILayerSearchSidebarProps) => {
  const { availableLayers, groupFilters, setGroupFilters } = props;

  // Extract unique top-level group names from availableLayers
  const topLevelGroups = Array.from(new Set(availableLayers.map((layer) => layer.group.split('/')[0]))).sort();

  return (
    <Box
      sx={{
        width: 240,
        borderRight: `1px solid ${grey[300]}`,
        bgcolor: grey[50],
        overflowY: 'auto',
        p: 2,
      }}>
      <List dense disablePadding>
        {topLevelGroups.map((group) => {
          const isSelected = groupFilters.includes(group);

          return (
            <ListItemButton
              key={group}
              selected={isSelected}
              onClick={() => setGroupFilters(group)}
              sx={{
                borderRadius: 1,
                px: 1.5,
                mb: 0.5,
              }}>
              <ListItemText primary={group} slotProps={{ primary: { fontWeight: 500, noWrap: true } }} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};
