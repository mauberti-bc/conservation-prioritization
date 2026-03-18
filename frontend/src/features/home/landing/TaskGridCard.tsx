import { Box, Card, useTheme } from '@mui/material';
import { IconMenuItem } from 'components/button/IconMenuButton';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { TaskGridCardFooter } from './card/TaskGridCardFooter';
import { TaskGridCardMapPreview } from './card/TaskGridCardMapPreview';

interface TaskGridCardProps {
  task: GetTaskResponse;
  onClick: (task: GetTaskResponse) => void;
  menuItems: IconMenuItem[];
}

/**
 * Card tile for a task in the landing page grid.
 *
 * Shows title and description on hover for desktop, and visible title content on mobile.
 */
export const TaskGridCard = ({ task, onClick, menuItems }: TaskGridCardProps) => {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        height: 320,
        borderRadius: 2,
        border: `2px solid ${theme.palette.divider}`,
        overflow: 'hidden',
      }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => {
          onClick(task);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick(task);
          }
        }}
        sx={{
          position: 'relative',
          height: '100%',
          width: '100%',
          cursor: 'pointer',
          outline: 'none',
          '&:focus-visible': {
            boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
          },
        }}>
        <TaskGridCardMapPreview task={task} />
        <TaskGridCardFooter task={task} menuItems={menuItems} />
      </Box>
    </Card>
  );
};
