import { describe, expect, it } from 'vitest';
import { GetTaskResponse, TaskExportResponse } from 'hooks/interfaces/useTaskApi.interface';
import { getLatestTaskExport, getTaskExportAction, isTaskLatestExportReady } from './task-export';

describe('task export utilities', () => {
  it('marks tasks without completed runs as unavailable', () => {
    expect(getTaskExportAction(buildTask({ latest_run: null }))).toBe('unavailable');
    expect(getTaskExportAction(buildTask({ latest_run: { ...buildRun(), status: 'running' } }))).toBe('unavailable');
  });

  it('opens export creation when no latest export exists or the latest export failed', () => {
    expect(getTaskExportAction(buildTask())).toBe('create');
    expect(getTaskExportAction(buildTaskWithExport({ status: 'failed' }))).toBe('create');
  });

  it('prevents duplicate exports while the newest export is queued or running', () => {
    expect(getTaskExportAction(buildTaskWithExport({ status: 'queued' }))).toBe('preparing');
    expect(getTaskExportAction(buildTaskWithExport({ status: 'running' }))).toBe('preparing');
  });

  it('marks ready exports as downloadable and primary', () => {
    const task = buildTaskWithExport({ status: 'ready' });

    expect(getTaskExportAction(task)).toBe('download');
    expect(isTaskLatestExportReady(task)).toBe(true);
    expect(getLatestTaskExport(task)?.task_export_id).toBe('export-id');
  });

  it('resolves export actions by format', () => {
    const task = buildTask({
      latest_run: {
        ...buildRun(),
        exports: [
          buildExport({ task_export_id: 'geodatabase-export-id', format: 'geodatabase', status: 'ready' }),
          buildExport({ task_export_id: 'geotiff-export-id', format: 'geotiff', status: 'running' }),
        ],
      },
    });

    expect(getTaskExportAction(task, 'geotiff')).toBe('preparing');
    expect(getTaskExportAction(task, 'geodatabase')).toBe('download');
    expect(getLatestTaskExport(task, 'geodatabase')?.task_export_id).toBe('geodatabase-export-id');
  });
});

function buildTask(overrides: Partial<GetTaskResponse> = {}): GetTaskResponse {
  return {
    task_id: 'task-id',
    type: 'discrete_optimization',
    name: 'Task',
    description: null,
    status: 'completed',
    latest_run: buildRun(),
    ...overrides,
  };
}

function buildTaskWithExport(exportOverrides: Partial<TaskExportResponse>): GetTaskResponse {
  return buildTask({
    latest_run: {
      ...buildRun(),
      exports: [buildExport(exportOverrides)],
    },
  });
}

function buildExport(exportOverrides: Partial<TaskExportResponse>): TaskExportResponse {
  return {
    task_export_id: 'export-id',
    task_run_id: 'run-id',
    source_artifact_id: 'artifact-id',
    format: 'geotiff',
    format_version: 'geotiff-v1',
    status: 'ready',
    attempt: 1,
    prefect_flow_run_id: null,
    prefect_deployment_id: null,
    source_checksum: null,
    specification: {},
    progress: {},
    resource_admission: null,
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    files: [],
    ...exportOverrides,
  };
}

function buildRun(): NonNullable<GetTaskResponse['latest_run']> {
  return {
    task_run_id: 'run-id',
    task_id: 'task-id',
    task_type: 'discrete_optimization',
    execution_method: 'compiled_discrete_optimization',
    execution_method_version: 'v1',
    status: 'completed',
    stage: null,
    revision: 1,
    artifacts: [],
    exports: [],
    solutions: [],
  };
}
