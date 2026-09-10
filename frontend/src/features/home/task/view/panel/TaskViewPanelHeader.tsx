import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { TaskStatusChip } from 'components/chip/TaskStatusChip';
import { TaskStatusValue } from 'constants/status';
import { TaskViewPanelActionsMenu } from './TaskViewPanelActionsMenu';

interface TaskViewPanelHeaderProps {
  title: string;
  status?: TaskStatusValue;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const TaskViewPanelHeader = ({
  title,
  status,
  onClose,
  onEdit,
  onShare,
  onDelete,
}: TaskViewPanelHeaderProps) => {
  return (
    <Box display="flex" gap={1} pb={2} alignItems="center">
      <Typography
        variant="h6"
        fontWeight={600}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </Typography>
      {status && <TaskStatusChip status={status} sx={{ flex: '0 0 auto' }} />}
      <TaskViewPanelActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} />
      <IconButton aria-label="Close task" onClick={onClose} edge="end" size="small">
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Box>
  );
};
