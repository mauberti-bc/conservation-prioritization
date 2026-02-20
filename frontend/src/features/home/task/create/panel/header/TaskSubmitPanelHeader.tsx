import { mdiAccountPlusOutline, mdiArrowLeft, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { IconMenuButton } from 'components/button/IconMenuButton';

interface TaskSubmitPanelHeaderProps {
  title: string;
  onBack: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const TaskSubmitPanelHeader = ({ title, onBack, onEdit, onShare, onDelete }: TaskSubmitPanelHeaderProps) => {
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <IconButton aria-label="Back to tasks" size="small" onClick={onBack}>
        <Icon path={mdiArrowLeft} size={1} />
      </IconButton>
      <Typography fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </Typography>
      <IconMenuButton
        items={[
          {
            label: 'Edit',
            icon: mdiPencilOutline,
            onClick: onEdit,
          },
          {
            label: 'Share',
            icon: mdiAccountPlusOutline,
            onClick: onShare,
          },
          {
            label: 'Delete',
            icon: mdiDeleteOutline,
            onClick: onDelete,
          },
        ]}
      />
    </Box>
  );
};
