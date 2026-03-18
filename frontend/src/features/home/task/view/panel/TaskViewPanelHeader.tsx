import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { TaskViewPanelActionsMenu } from './TaskViewPanelActionsMenu';

interface TaskViewPanelHeaderProps {
  title: string;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const TaskViewPanelHeader = ({ title, onEdit, onShare, onDelete }: TaskViewPanelHeaderProps) => {
  return (
    <Box display="flex" gap={1} pb={2}>
      <Typography
        variant="h6"
        fontWeight={600}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </Typography>
      <TaskViewPanelActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} />
    </Box>
  );
};
