import { mdiAccountPlusOutline, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js';
import { IconMenuButton } from 'components/button/IconMenuButton';

interface TaskViewPanelActionsMenuProps {
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const TaskViewPanelActionsMenu = ({ onEdit, onShare, onDelete }: TaskViewPanelActionsMenuProps) => {
  return (
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
  );
};
