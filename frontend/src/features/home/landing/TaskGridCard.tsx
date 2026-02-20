import { Box, Card, CardActionArea, useTheme } from '@mui/material';
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
      <CardActionArea
        sx={{ height: '100%' }}
        onClick={() => {
          onClick(task);
        }}>
        <Box
          sx={{
            position: 'relative',
            height: '100%',
          }}>
          <TaskGridCardMapPreview task={task} />
          <TaskGridCardFooter task={task} menuItems={menuItems} />
        </Box>
      </CardActionArea>
    </Card>
  );
};
