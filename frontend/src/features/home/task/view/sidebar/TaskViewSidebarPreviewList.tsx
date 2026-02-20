import { mdiAccountPlusOutline, mdiPencilOutline, mdiShareVariantOutline } from '@mdi/js';
import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { IconMenuButton } from 'components/button/IconMenuButton';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useState } from 'react';

interface TaskViewSidebarPreviewListProps {
  previewTasks: GetTaskResponse[];
  taskId: string;
  onSelectTask: (task: GetTaskResponse) => void;
}

export const TaskViewSidebarPreviewList = ({ previewTasks, taskId, onSelectTask }: TaskViewSidebarPreviewListProps) => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  return (
    <List dense sx={{ pt: 0, overflowY: 'auto', flex: '1 1 0', minHeight: 0, height: '100%', maxHeight: '100%' }}>
      {previewTasks.map((task) => {
        const isSelected = task.task_id === taskId;
        const showActions = hoveredTaskId === task.task_id || isSelected;

        return (
          <ListItem
            key={task.task_id}
            disablePadding
            onMouseEnter={() => {
              setHoveredTaskId(task.task_id);
            }}
            onMouseLeave={() => {
              setHoveredTaskId((current) => {
                if (current === task.task_id) {
                  return null;
                }

                return current;
              });
            }}
            secondaryAction={
              showActions ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    '& [role="button"]': {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1,
                      px: 0.5,
                      py: 0.25,
                      '&:hover': {
                        bgcolor: grey[300],
                      },
                    },
                    '& svg': {
                      color: grey[600],
                    },
                  }}>
                  <IconMenuButton
                    inlineTrigger
                    items={[
                      {
                        label: 'Share',
                        icon: mdiShareVariantOutline,
                        onClick: () => {
                          onSelectTask(task);
                        },
                      },
                      {
                        label: 'Invite',
                        icon: mdiAccountPlusOutline,
                        onClick: () => {
                          onSelectTask(task);
                        },
                      },
                      {
                        label: 'Edit',
                        icon: mdiPencilOutline,
                        onClick: () => {
                          onSelectTask(task);
                        },
                      },
                    ]}
                  />
                </Box>
              ) : undefined
            }>
            <ListItemButton
              sx={{ py: 0.75, pr: 6, alignItems: 'center' }}
              selected={isSelected}
              onClick={() => {
                onSelectTask(task);
              }}>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap sx={{ color: isSelected ? 'inherit' : grey[600] }}>
                    {task.name}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};
