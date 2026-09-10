import { mdiAccountPlusOutline, mdiDeleteOutline, mdiPencilOutline, mdiStopCircleOutline } from '@mdi/js';
import { IconMenuButton } from 'components/button/IconMenuButton';

interface TaskViewPanelActionsMenuProps {
  showAbort: boolean;
  onEdit: () => void;
  onShare: () => void;
  onAbort: () => void;
  onDelete: () => void;
}

/** Renders the task header actions. */
export const TaskViewPanelActionsMenu = ({
  showAbort,
  onEdit,
  onShare,
  onAbort,
  onDelete,
}: TaskViewPanelActionsMenuProps) => {
  return (
    <IconMenuButton
      items={[
        ...(showAbort
          ? [
              {
                label: 'Abort',
                icon: mdiStopCircleOutline,
                onClick: onAbort,
              },
            ]
          : []),
        {
          label: 'Edit',
          icon: mdiPencilOutline,
          dividerBefore: showAbort,
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
          color: 'error',
          dividerBefore: true,
          onClick: onDelete,
        },
      ]}
    />
  );
};
