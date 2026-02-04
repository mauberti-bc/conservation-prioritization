import { mdiArrowLeft } from '@mdi/js';
import Icon from '@mdi/react';
import { Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useTaskContext } from 'hooks/useContext';

/**
 * View-only task detail panel that renders the task form disabled.
 */
export const TaskDetailsPanel = () => {
  const { taskDataLoader, taskId, setFocusedTask } = useTaskContext();

  const task = taskDataLoader.data;

  return (
    <LoadingGuard
      isLoading={Boolean(taskId) && (taskDataLoader.isLoading || !taskDataLoader.hasLoaded)}
      isLoadingFallback={
        <Box p={3}>
          <Typography>Loading task...</Typography>
        </Box>
      }
      hasNoData={!taskId}
      hasNoDataFallback={
        <Box p={3}>
          <Typography color="textSecondary">Select a task to view its configuration.</Typography>
        </Box>
      }>
      <LoadingGuard
        isLoading={false}
        hasNoData={Boolean(taskDataLoader.error || !task)}
        hasNoDataFallback={
          <Box p={3}>
            <Typography color="error">Failed to load task.</Typography>
          </Box>
        }>
        <Box sx={{ overflow: 'auto' }}>
          <Box display="flex" alignItems="center" gap={1} mb={2} p={2}>
            <IconButton
              aria-label="Back to tasks"
              size="small"
              onClick={() => {
                setFocusedTask(null);
              }}>
              <Icon path={mdiArrowLeft} size={1} />
            </IconButton>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task?.name ?? 'Task details'}
            </Typography>
          </Box>

          <Box px={3} pb={3} display="flex" flexDirection="column" gap={3}>
            <Stack gap={1}>
              <Typography variant="overline" color="text.secondary">
                Summary
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {task?.status && <Chip size="small" label={task.status} color="primary" />}
                {task?.variant && <Chip size="small" label={`Variant: ${task.variant}`} />}
                {task?.resampling && <Chip size="small" label={`Resampling: ${task.resampling}`} />}
                {typeof task?.resolution === 'number' && <Chip size="small" label={`Resolution: ${task.resolution}`} />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {task?.description || 'No description provided.'}
              </Typography>
            </Stack>

            <Divider />

            <Stack gap={2}>
              <Typography variant="overline" color="text.secondary">
                Layers
              </Typography>
              {(task?.layers ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No layers configured.
                </Typography>
              )}
              {(task?.layers ?? []).map((layer) => {
                const constraints = layer.constraints ?? [];
                return (
                  <Box
                    key={layer.task_layer_id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                      <Typography fontWeight={600}>{layer.layer_name}</Typography>
                      <Chip size="small" label={layer.mode} />
                      {typeof layer.importance === 'number' && (
                        <Chip size="small" label={`Importance: ${layer.importance}`} />
                      )}
                      {typeof layer.threshold === 'number' && (
                        <Chip size="small" label={`Threshold: ${layer.threshold}`} />
                      )}
                    </Stack>
                    {layer.description && (
                      <Typography variant="body2" color="text.secondary">
                        {layer.description}
                      </Typography>
                    )}
                    <Stack gap={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Constraints
                      </Typography>
                      {constraints.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                      {constraints.map((constraint) => {
                        const min = constraint.min ?? '–';
                        const max = constraint.max ?? '–';
                        return (
                          <Typography key={constraint.task_layer_constraint_id} variant="body2">
                            {constraint.type}: {min} to {max}
                          </Typography>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Box>
      </LoadingGuard>
    </LoadingGuard>
  );
};
