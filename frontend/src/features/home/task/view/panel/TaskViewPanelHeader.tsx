import { mdiClose, mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { TaskViewPanelActionsMenu } from './TaskViewPanelActionsMenu';

interface TaskViewPanelHeaderProps {
  title: string;
  isExportReady: boolean;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

export const TaskViewPanelHeader = ({
  title,
  isExportReady,
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
      <IconButton
        aria-label="Download task export"
        color={isExportReady ? 'primary' : 'default'}
        onClick={onDownload}
        size="small">
        <Icon path={mdiDownload} size={0.75} />
      </IconButton>
      <TaskViewPanelActionsMenu onEdit={onEdit} onShare={onShare} onDelete={onDelete} />
      <IconButton aria-label="Close task" onClick={onClose} edge="end" size="small">
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Box>
  );
};
