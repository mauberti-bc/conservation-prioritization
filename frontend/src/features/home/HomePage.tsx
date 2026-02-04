import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { TASK_STATUS, TILE_STATUS } from 'constants/status';
import { AuthContext } from 'context/authContext';
import { useMapContext, useProjectContext, useSidebarUIContext, useTaskContext } from 'hooks/useContext';
import { useContext, useEffect, useMemo } from 'react';
import { MainPanel } from './main-panel/MainPanel';
import { DrawControls } from './map/draw/DrawControls';
import { MapContainer } from './map/MapContainer';
import { Sidebar } from './sidebar/Sidebar';
import { useTaskStatusWebSocket } from './task/status/useTaskStatusWebSocket';

export const HomePage = () => {
  const { drawControlsRef } = useMapContext();
  const { taskId, taskDataLoader, setFocusedTask, tasksDataLoader, refreshTasks } = useTaskContext();
  const { projectsDataLoader } = useProjectContext();
  const { activeView, setActiveView } = useSidebarUIContext();
  const { data: taskStatus } = useTaskStatusWebSocket(taskId);
  const authContext = useContext(AuthContext);
  const isAuthenticated = Boolean(authContext?.auth?.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (activeView === 'tasks') {
      void tasksDataLoader.load();
    }

    if (activeView === 'projects') {
      void projectsDataLoader.load();
    }
  }, [activeView, isAuthenticated, tasksDataLoader, projectsDataLoader]);

  const pmtilesUrls = useMemo(() => {
    const statusUri =
      taskStatus?.tile?.status === TILE_STATUS.COMPLETED && taskStatus.tile.uri ? taskStatus.tile.uri : null;
    const fallbackUri = taskDataLoader.data?.tileset_uri ?? null;
    const resolvedUri = statusUri ?? fallbackUri;

    return resolvedUri ? [resolvedUri] : [];
  }, [taskStatus, taskDataLoader.data]);

  const statusLabel = useMemo(() => {
    const activeStatus = taskStatus?.status ?? taskDataLoader.data?.status;
    const tileStatus = taskStatus?.tile?.status ?? null;

    if (!activeStatus) {
      return null;
    }

    if (activeStatus === TASK_STATUS.COMPLETED && tileStatus && tileStatus !== TILE_STATUS.COMPLETED) {
      return `${activeStatus} (tiling: ${tileStatus})`;
    }

    return activeStatus;
  }, [taskStatus, taskDataLoader.data]);

  const memoizedMap = useMemo(() => {
    return (
      <>
        <MapContainer pmtilesUrls={pmtilesUrls} />
        <DrawControls ref={drawControlsRef} />
      </>
    );
  }, [drawControlsRef, pmtilesUrls]);

  return (
    <Stack flex="1" direction="row" m={0} p={0} overflow="hidden" height="100%">
      <Box sx={{ width: 360, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          tasksDataLoader={tasksDataLoader}
          projectsDataLoader={projectsDataLoader}
          isAuthenticated={isAuthenticated}
          selectedTaskId={taskId}
          onSelectTask={(task) => {
            setFocusedTask(task);
            setActiveView('tasks');
          }}
        />
      </Box>

      <Box sx={{ width: 520, flexShrink: 0, height: '100%', borderRight: '1px solid', borderColor: 'divider' }}>
        <MainPanel
          activeView={activeView}
          onTaskCreated={() => {
            void refreshTasks();
          }}
        />
      </Box>

      <Box flex="1" display="flex" flexDirection="column" overflow="hidden" height="100%" position="relative">
        {taskId && statusLabel && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}>
            <Chip size="small" color="primary" label={statusLabel} />
          </Box>
        )}
        {memoizedMap}
      </Box>
    </Stack>
  );
};
