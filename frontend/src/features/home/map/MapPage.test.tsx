/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IApplicationEventsContext } from 'context/applicationEventsContext';
import { GetTaskResponse, TaskExportResponse, TaskRunAreaResponse } from 'hooks/interfaces/useTaskApi.interface';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPage } from './MapPage';

const mocks = vi.hoisted(() => ({
  taskApi: {
    getAllTasks: vi.fn(),
    getTaskById: vi.fn(),
    getTaskExports: vi.fn(),
    createTaskExport: vi.fn(),
    deleteTask: vi.fn(),
    abortTask: vi.fn(),
  },
  events: {} as IApplicationEventsContext,
  dialog: { setSnackbar: vi.fn(), setYesNoDialog: vi.fn() },
  map: { drawControlsRef: { current: null } },
  mapContainer: vi.fn(),
}));

vi.mock('hooks/useConservationApi', () => ({ useConservationApi: () => ({ task: mocks.taskApi }) }));
vi.mock('hooks/useContext', () => ({
  useApplicationEventsContext: () => mocks.events,
  useDialogContext: () => mocks.dialog,
  useMapContext: () => mocks.map,
}));
vi.mock('./MapContainer', () => ({
  MapContainer: (props: unknown) => {
    mocks.mapContainer(props);
    return null;
  },
}));
vi.mock('./draw/DrawControls', () => ({ DrawControls: () => null }));
vi.mock('../task/create/CreateTask', () => ({ CreateTask: () => null }));
vi.mock('../task/view/panel/TaskViewPanel', () => ({ TaskViewPanel: () => null }));
vi.mock('../task/view/dialog/TaskViewEditDialog', () => ({ TaskViewEditDialog: () => null }));
vi.mock('../task/view/dialog/TaskViewInviteDialog', () => ({ TaskViewInviteDialog: () => null }));
vi.mock('components/button/IconMenuButton', () => ({
  IconMenuButton: ({ items }: { items: { label: string; onClick: () => void }[] }) => (
    <span>
      {items.map((item) => (
        <button key={item.label} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </span>
  ),
}));
vi.mock('components/list/InteractiveListItemButton', () => ({
  InteractiveListItemButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

/** Builds a task with the run fields consumed by the map workspace. */
function buildTask(status = 'completed', areas: TaskRunAreaResponse[] = []): GetTaskResponse {
  return {
    task_id: 'task-1',
    name: 'Conservation task',
    status,
    latest_run: { task_run_id: 'run-1', status, exports: [], artifacts: [], areas },
  } as unknown as GetTaskResponse;
}

/** Builds an export with the metadata consumed by the format dialog. */
function buildExport(status: TaskExportResponse['status']): TaskExportResponse {
  return { task_export_id: 'export-1', format: 'geotiff', status, files: [] } as unknown as TaskExportResponse;
}

/** Mounts the map list with its real loaders and export dialog. */
function workspace(initialEntry = '/map') {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <MapPage />
    </MemoryRouter>
  );
}

describe('MapPage task and export refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events = {
      taskRevisions: {},
      taskStatuses: {},
      connectionEpoch: 0,
      unseenTaskIds: new Set(),
      markTaskSeen: vi.fn(),
    };
    mocks.taskApi.getAllTasks.mockResolvedValue({
      tasks: [buildTask()],
      pagination: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
    });
    mocks.taskApi.getTaskById.mockResolvedValue(buildTask());
    mocks.taskApi.getTaskExports.mockResolvedValue([]);
    mocks.taskApi.createTaskExport.mockResolvedValue(buildExport('queued'));
  });

  afterEach(() => {
    cleanup();
  });

  it('requests abort for the selected task and refreshes the list', async () => {
    mocks.taskApi.abortTask.mockResolvedValue(undefined);
    render(workspace());
    const abortButton = await screen.findByRole('button', { name: 'Abort' });
    const initialRequests = mocks.taskApi.getAllTasks.mock.calls.length;
    fireEvent.click(abortButton);
    await waitFor(() => expect(mocks.taskApi.abortTask).toHaveBeenCalledWith('task-1'));
    await waitFor(() => expect(mocks.taskApi.getAllTasks).toHaveBeenCalledTimes(initialRequests + 1));
    expect(mocks.dialog.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Abort requested.' });
  });

  it('reports abort failures without showing success', async () => {
    mocks.taskApi.abortTask.mockRejectedValueOnce(new Error('Unavailable'));
    render(workspace());
    const abortButton = await screen.findByRole('button', { name: 'Abort' });
    const initialRequests = mocks.taskApi.getAllTasks.mock.calls.length;
    fireEvent.click(abortButton);
    await waitFor(() =>
      expect(mocks.dialog.setSnackbar).toHaveBeenCalledWith({
        open: true,
        snackbarMessage: 'Failed to abort task. Please try again.',
      })
    );
    expect(mocks.taskApi.getAllTasks).toHaveBeenCalledTimes(initialRequests);
  });

  it.each(['ready', 'failed'] as const)('updates an open export dialog when the job becomes %s', async (status) => {
    mocks.taskApi.getTaskExports.mockResolvedValue([buildExport('queued')]);
    render(workspace());
    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));
    await waitFor(() => expect(mocks.taskApi.getTaskExports).toHaveBeenCalledWith('run-1'));
    mocks.taskApi.getTaskExports.mockResolvedValue([buildExport(status)]);

    await waitFor(
      () => {
        const buttons = screen.queryAllByRole('button', { name: status === 'ready' ? 'Download' : 'Export' });
        expect(buttons.length > 0 && buttons.every((button) => !button.hasAttribute('disabled'))).toBe(true);
      },
      { timeout: 3500 }
    );
  });

  it('refreshes run data after a task-list completion event', async () => {
    mocks.taskApi.getAllTasks.mockResolvedValue({ tasks: [buildTask('running')] });
    const view = render(workspace());
    await screen.findByText('Conservation task');
    await act(async () => {});
    mocks.taskApi.getAllTasks.mockResolvedValue({ tasks: [buildTask()] });
    mocks.events = { ...mocks.events, taskRevisions: { 'task-1': 1 }, taskStatuses: { 'task-1': 'completed' } };
    view.rerender(workspace());
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Create export')).toBeTruthy();
    expect(mocks.dialog.setSnackbar).not.toHaveBeenCalled();
  });

  it('refreshes an export created from the open dialog', async () => {
    render(workspace());
    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));
    await waitFor(() => expect(mocks.taskApi.getTaskExports).toHaveBeenCalledWith('run-1'));
    mocks.taskApi.getTaskExports.mockResolvedValue([buildExport('ready')]);
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Export' })[0]);

    expect(await screen.findByRole('button', { name: 'Download' })).toBeTruthy();
    expect(mocks.taskApi.createTaskExport).toHaveBeenCalledWith('run-1', { format: 'geotiff' });
  });

  it('returns to the previous page after deleting the last task on page two', async () => {
    let deleted = false;
    mocks.taskApi.getAllTasks.mockImplementation(async ({ page }: { page: number }) => ({
      tasks: deleted && page === 2 ? [] : [buildTask()],
      pagination: { current_page: page, per_page: 25, total: deleted ? 25 : 26, last_page: deleted ? 1 : 2 },
    }));
    mocks.taskApi.deleteTask.mockImplementation(async () => {
      deleted = true;
    });
    render(workspace());
    fireEvent.click(await screen.findByRole('button', { name: 'Go to next page' }));
    await screen.findByText('26-26 of 26');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {
      await mocks.dialog.setYesNoDialog.mock.calls[0][0].onYes();
    });
    expect(await screen.findByText('1-25 of 25')).toBeTruthy();
    expect(screen.getByText('Conservation task')).toBeTruthy();
  });

  it('passes merged target-area bounds to the map on a task route', async () => {
    mocks.taskApi.getTaskById.mockResolvedValue(
      buildTask('completed', [
        {
          task_run_area_id: 'area-1',
          geojson: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-124, 49],
                  [-123, 49],
                  [-123, 50],
                  [-124, 50],
                  [-124, 49],
                ],
              ],
            },
          },
        },
        {
          task_run_area_id: 'area-2',
          geojson: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-130, 52],
                  [-129, 52],
                  [-129, 53],
                  [-130, 53],
                  [-130, 52],
                ],
              ],
            },
          },
        },
      ] as TaskRunAreaResponse[])
    );

    render(workspace('/map/task-1'));
    await waitFor(() => expect(mocks.taskApi.getTaskById).toHaveBeenCalledWith('task-1'));
    await waitFor(() =>
      expect(mocks.mapContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          boundsRefreshKey: 'task-1',
          fitBounds: [
            [-130, 49],
            [-123, 53],
          ],
        })
      )
    );
  });
});
