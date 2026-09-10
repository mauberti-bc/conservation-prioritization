import { mdiProgressClock } from '@mdi/js';
import Icon from '@mdi/react';
import { Chip, CircularProgress, SxProps, Theme } from '@mui/material';
import { TASK_STATUS, TaskStatusValue } from 'constants/status';
import { ReactElement } from 'react';
import { getTaskViewStatusColor } from 'utils/colour';
import { getTaskStatusLabel } from 'utils/task-status';

interface TaskStatusChipProps {
  status: TaskStatusValue;
  sx?: SxProps<Theme>;
}

/**
 * Displays a task status with activity or waiting indicators where applicable.
 *
 * @param {TaskStatusChipProps} props The task status and optional chip styles.
 * @returns {ReactElement} The task status chip.
 */
export const TaskStatusChip = ({ status, sx }: TaskStatusChipProps): ReactElement => {
  let icon: ReactElement | undefined;
  if (status === TASK_STATUS.RUNNING || status === TASK_STATUS.IN_PROGRESS) {
    icon = <CircularProgress size={14} thickness={4} color="inherit" aria-label="Task running" />;
  } else if (status === TASK_STATUS.PENDING || status === TASK_STATUS.SUBMITTED) {
    icon = <Icon path={mdiProgressClock} size={0.7} title="Task waiting" />;
  }

  return <Chip label={getTaskStatusLabel(status)} color={getTaskViewStatusColor(status)} icon={icon} sx={sx} />;
};
