import { Box, List, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { InviteDialog } from 'components/dialog/InviteDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext, useProjectContext, useTaskContext } from 'hooks/useContext';
import { useState } from 'react';
import { AddTaskToProjectDialog } from './dialog/AddTaskToProjectDialog';
import { TaskListItem } from './TaskListItem';

interface TaskListProps {
  tasks: GetTaskResponse[];
  isLoading: boolean;
  onSelectTask: (task: GetTaskResponse) => void;
  onEditTask?: (task: GetTaskResponse) => void;
  enableActions?: boolean;
  enableProjectDialog?: boolean;
}

export const TaskList = ({
  tasks,
  isLoading,
  onSelectTask,
  onEditTask,
  enableActions = true,
  enableProjectDialog = true,
}: TaskListProps) => {
  const dialogContext = useDialogContext();
  const conservationApi = useConservationApi();
  const { refreshTasks } = useTaskContext();
  const { refreshProjects } = useProjectContext();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [projectDialogTaskIds, setProjectDialogTaskIds] = useState<string[]>([]);
  const [inviteTask, setInviteTask] = useState<GetTaskResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleDeleteTask = (task: GetTaskResponse) => {
    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete task?',
      dialogText: `Are you sure you want to delete "${task.name}"?`,
      onYes: async () => {
        dialogContext.setYesNoDialog({ open: false });
        await conservationApi.task.deleteTask(task.task_id);
        await refreshTasks();
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
    });
  };

  const handleAddToProject = (task: GetTaskResponse) => {
    if (!enableProjectDialog) {
      return;
    }
    setSelectedTaskIds([task.task_id]);
    setProjectDialogTaskIds([task.task_id]);
    setProjectDialogOpen(true);
  };

  const handleInviteTask = (task: GetTaskResponse) => {
    setInviteError(null);
    setInviteTask(task);
  };

  const handleInviteSubmit = async (emails: string[]) => {
    if (!inviteTask) {
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);

      const result = await conservationApi.task.inviteProfilesToTask(inviteTask.task_id, { emails });
      const skippedCount = result.skipped_emails.length;
      const addedCount = result.added_profile_ids.length;

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage:
          skippedCount > 0
            ? `Invited ${addedCount} profile(s). Skipped ${skippedCount} email(s).`
            : `Invited ${addedCount} profile(s).`,
      });

      setInviteTask(null);
    } catch (error) {
      console.error('Failed to invite profiles to task', error);
      setInviteError('Failed to send invites. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleConfirmAddToProject = async (projectIds: string[]) => {
    if (projectIds.length === 0 || selectedTaskIds.length === 0) {
      return;
    }

    await Promise.all(
      selectedTaskIds.map((taskId) => {
        return conservationApi.task.addProjectsToTask(taskId, projectIds);
      })
    );

    await refreshProjects();
    await refreshTasks();
    setProjectDialogOpen(false);
  };

  return (
    <Box sx={{ overflowY: 'auto', maxHeight: '100%' }}>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={<SkeletonList numberOfLines={3} />}
        hasNoData={tasks.length === 0}
        hasNoDataFallback={
          <Box display="flex" alignItems="center" justifyContent="center" p={5} bgcolor={grey[100]}>
            <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
              No tasks yet
            </Typography>
          </Box>
        }>
        <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tasks.map((task) => (
            <TaskListItem
              key={task.task_id}
              task={task}
              onSelectTask={onSelectTask}
              onEditTask={onEditTask}
              onDeleteTask={handleDeleteTask}
              onAddToProject={handleAddToProject}
              onInvite={handleInviteTask}
              showActions={enableActions}
            />
          ))}
        </List>
      </LoadingGuard>
      {enableProjectDialog && (
        <AddTaskToProjectDialog
          open={projectDialogOpen}
          taskIds={projectDialogTaskIds}
          onClose={() => {
            setProjectDialogOpen(false);
          }}
          onSubmit={handleConfirmAddToProject}
        />
      )}
      <InviteDialog
        open={Boolean(inviteTask)}
        title={inviteTask ? `Invite to ${inviteTask.name}` : 'Invite to Task'}
        description="Enter email addresses to add existing profiles to this task."
        onClose={() => {
          setInviteTask(null);
        }}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteLoading}
        error={inviteError}
      />
    </Box>
  );
};
