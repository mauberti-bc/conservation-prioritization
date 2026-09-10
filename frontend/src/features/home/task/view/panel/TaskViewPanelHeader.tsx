import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { TaskViewPanelActionsMenu } from './TaskViewPanelActionsMenu';
import { TaskStatusChip } from 'components/chip/TaskStatusChip';
import { TaskStatusValue } from 'constants/status';

interface TaskViewPanelHeaderProps {
  title: string;
  status?: TaskStatusValue;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

export const TaskViewPanelHeader = ({
  title,
  status,
  onClose,
  onEdit,
  onShare,
  onDelete,
  onDownload,
}: TaskViewPanelHeaderProps) => {
  return (
    <Box display="flex" gap={1} pb={2}>
      <Typography
        variant="h6"
        fontWeight={600}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </Typography>
      {status && <TaskStatusChip status={status} sx={{ flex: '0 0 auto' }} />}
      <Button variant="contained" color="primary" size="small" onClick={onDownload}>
        Export
      </Button>
      <TaskViewPanelActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} />
      <IconButton aria-label="Close task" onClick={onClose} edge="end" size="small">
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Box>
  );
};
