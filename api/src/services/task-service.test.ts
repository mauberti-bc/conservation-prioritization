import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { Artifact } from '../models/artifact';
import { Task } from '../models/task';
import { TaskExport } from '../models/task-export';
import { TaskExportFile } from '../models/task-export-file';
import { TaskRun } from '../models/task-run';
import { TaskRunArea } from '../models/task-run-area';
import { TaskRunSolution } from '../models/task-run-solution';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { DashboardTaskRepository } from '../repositories/dashboard-task-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { TaskExportFileRepository } from '../repositories/task-export-file-repository';
import { TaskExportRepository } from '../repositories/task-export-repository';
import { TaskRepository } from '../repositories/task-repository';
import { TaskRunAreaRepository } from '../repositories/task-run-area-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import { TaskRunSolutionRepository } from '../repositories/task-run-solution-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { TaskService } from './task-service';

const TASK_ID = '00000000-0000-4000-8000-000000000001';
const TASK_RUN_ID = '00000000-0000-4000-8000-000000000002';
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000003';
const EXPORT_ID = '00000000-0000-4000-8000-000000000004';
const FILE_ID = '00000000-0000-4000-8000-000000000005';
const SOLUTION_ID = '00000000-0000-4000-8000-000000000006';
const AREA_ID = '00000000-0000-4000-8000-000000000007';

describe('TaskService export hydration', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('includes latest run exports and files on task details', async () => {
    sinon.stub(TaskRepository.prototype, 'getTaskById').resolves(buildTask());
    sinon.stub(ProjectRepository.prototype, 'getProjectsByTaskIds').resolves([]);
    sinon.stub(DashboardTaskRepository.prototype, 'getLatestDashboardIdForTask').resolves(null);
    sinon.stub(TaskRunRepository.prototype, 'getLatestTaskRunByTaskId').resolves(buildTaskRun());
    sinon.stub(ArtifactRepository.prototype, 'getArtifactsByRunId').resolves([buildArtifact()]);
    sinon.stub(TaskRunAreaRepository.prototype, 'getTaskRunAreasByRunIds').resolves([buildArea()]);
    sinon.stub(TaskRunSolutionRepository.prototype, 'getTaskRunSolutions').resolves([buildSolution()]);
    sinon.stub(TaskExportRepository.prototype, 'getTaskExportsByRunIds').resolves([buildTaskExport()]);
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFilesByExportIds').resolves([buildTaskExportFile()]);

    const task = await new TaskService(getMockDBConnection()).getTaskById(TASK_ID);

    expect(task.latest_run?.exports).to.have.length(1);
    expect(task.latest_run?.exports[0].task_export_id).to.equal(EXPORT_ID);
    expect(task.latest_run?.exports[0].files).to.deep.equal([buildTaskExportFile()]);
    expect(task.latest_run?.areas).to.deep.equal([buildArea()]);
  });

  it('includes latest run exports on paginated task list responses', async () => {
    sinon.stub(TaskRepository.prototype, 'getTasksByProfileIdPaginated').resolves({ tasks: [buildTask()], total: 1 });
    sinon.stub(ProjectRepository.prototype, 'getProjectsByTaskIds').resolves([]);
    sinon.stub(TaskRunRepository.prototype, 'getLatestTaskRunByTaskId').resolves(buildTaskRun());
    sinon.stub(ArtifactRepository.prototype, 'getArtifactsByRunId').resolves([]);
    sinon.stub(TaskRunAreaRepository.prototype, 'getTaskRunAreasByRunIds').resolves([buildArea()]);
    sinon.stub(TaskRunSolutionRepository.prototype, 'getTaskRunSolutions').resolves([]);
    const getTaskExportsByRunIdsStub = sinon
      .stub(TaskExportRepository.prototype, 'getTaskExportsByRunIds')
      .resolves([buildTaskExport()]);
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFilesByExportIds').resolves([buildTaskExportFile()]);

    const response = await new TaskService(getMockDBConnection()).getTasksForProfilePaginated('profile-id', {
      page: 1,
      limit: 25,
      sort: 'created_at',
      order: 'desc'
    });

    expect(response.tasks[0].latest_run?.exports[0].files).to.deep.equal([buildTaskExportFile()]);
    expect(response.tasks[0].latest_run?.areas).to.deep.equal([buildArea()]);
    expect(getTaskExportsByRunIdsStub).to.have.been.calledOnceWith([TASK_RUN_ID]);
  });
});

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: TASK_ID,
    type: 'discrete_optimization',
    name: 'Export task',
    description: null,
    resolution: 30,
    resampling: 'mode',
    tileset_uri: null,
    output_uri: null,
    status: 'completed',
    status_message: null,
    prefect_flow_run_id: null,
    prefect_deployment_id: null,
    ...overrides
  };
}

function buildTaskRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    task_run_id: TASK_RUN_ID,
    task_id: TASK_ID,
    task_type: 'discrete_optimization',
    analytical_source_id: null,
    execution_method: 'compiled_discrete_optimization',
    execution_method_version: 'v1',
    status: 'completed',
    stage: null,
    revision: 1,
    input_snapshot: {},
    input_hash: 'hash',
    planning_unit_definition: {},
    solver_config: {},
    code_version: null,
    solver_name: null,
    solver_version: null,
    solver_status: null,
    objective_value: null,
    optimality_gap: null,
    runtime_seconds: null,
    preliminary_estimate: null,
    admission_outcome: null,
    progress: null,
    planning_unit_count: null,
    feature_nonzero_count: null,
    neighbor_edge_count: null,
    prefect_flow_run_id: null,
    prefect_deployment_id: null,
    dispatch_attempts: 1,
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    cancelled_at: null,
    ...overrides
  };
}

function buildArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    artifact_id: ARTIFACT_ID,
    task_run_id: TASK_RUN_ID,
    type: 'canonical_result',
    status: 'ready',
    uri: 's3://exports/runs/canonical.zarr/manifest.json',
    content_type: 'application/json',
    checksum: 'checksum',
    size_bytes: 1024,
    cache_key: null,
    manifest: {},
    lineage: {},
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    ...overrides
  };
}

function buildSolution(overrides: Partial<TaskRunSolution> = {}): TaskRunSolution {
  return {
    task_run_solution_id: SOLUTION_ID,
    task_run_id: TASK_RUN_ID,
    solution_index: 0,
    role: 'reference',
    status: 'ready',
    objective_value: null,
    resource_value: null,
    selected_planning_unit_count: null,
    optimality_gap: null,
    solver_name: null,
    solver_version: null,
    runtime_seconds: null,
    metrics: {},
    ...overrides
  };
}

function buildArea(overrides: Partial<TaskRunArea> = {}): TaskRunArea {
  return {
    task_run_area_id: AREA_ID,
    task_run_id: TASK_RUN_ID,
    area_index: 0,
    name: 'Area 1',
    description: null,
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-123, 49],
            [-122, 49],
            [-122, 50],
            [-123, 50],
            [-123, 49]
          ]
        ]
      }
    },
    ...overrides
  };
}

function buildTaskExport(overrides: Partial<TaskExport> = {}): TaskExport {
  return {
    task_export_id: EXPORT_ID,
    task_run_id: TASK_RUN_ID,
    source_artifact_id: ARTIFACT_ID,
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
    ...overrides
  };
}

function buildTaskExportFile(overrides: Partial<TaskExportFile> = {}): TaskExportFile {
  return {
    task_export_file_id: FILE_ID,
    task_export_id: EXPORT_ID,
    part_index: 0,
    filename: 'decision_y000000_x000000.tif',
    object_key: 'task-exports/00000000-0000-4000-8000-000000000004/parts/decision_y000000_x000000.tif',
    content_type: 'image/tiff',
    byte_size: 1024,
    checksum: 'checksum',
    row_offset: 0,
    column_offset: 0,
    width: 512,
    height: 512,
    transform: {},
    metadata: {},
    ...overrides
  };
}
