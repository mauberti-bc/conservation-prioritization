import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Artifact } from '../models/artifact';
import { TaskExport } from '../models/task-export';
import { TaskExportFile } from '../models/task-export-file';
import { TaskRun } from '../models/task-run';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { TaskExportFileRepository } from '../repositories/task-export-file-repository';
import { TaskExportRepository } from '../repositories/task-export-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import * as objectStore from '../utils/object-store';
import { getMockDBConnection } from '../__mocks__/db';
import { PrefectService } from './prefect-service';
import { TaskExportService } from './task-export-service';

chai.use(sinonChai);

const TASK_RUN_ID = '00000000-0000-4000-8000-000000000001';
const TASK_ID = '00000000-0000-4000-8000-000000000002';
const EXPORT_ID = '00000000-0000-4000-8000-000000000003';
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000004';
const FILE_ID = '00000000-0000-4000-8000-000000000005';

describe('TaskExportService', () => {
  const prefectApiUrl = process.env.PREFECT_API_URL;

  beforeEach(() => {
    process.env.PREFECT_API_URL = 'http://prefect.example';
  });

  afterEach(() => {
    if (prefectApiUrl) {
      process.env.PREFECT_API_URL = prefectApiUrl;
    } else {
      delete process.env.PREFECT_API_URL;
    }
    sinon.restore();
  });

  it('creates a queued GeoTIFF export without dispatching before commit', async () => {
    sinon.stub(TaskRunRepository.prototype, 'getTaskRunById').resolves(buildTaskRun());
    sinon.stub(ArtifactRepository.prototype, 'getArtifactByRunAndType').resolves(buildArtifact());
    sinon.stub(TaskExportRepository.prototype, 'createTaskExport').resolves(buildTaskExport());
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFilesByExportId').resolves([]);
    const submitTaskExportStub = sinon.stub(PrefectService.prototype, 'submitTaskExport');

    const taskExport = await new TaskExportService(getMockDBConnection()).createQueuedExport(TASK_RUN_ID);

    expect(taskExport.task_export_id).to.equal(EXPORT_ID);
    expect(taskExport.files).to.deep.equal([]);
    expect(submitTaskExportStub).not.to.have.been.called;
  });

  it('dispatches a persisted queued export', async () => {
    sinon.stub(TaskExportRepository.prototype, 'getTaskExportForUpdate').resolves(buildTaskExport());
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFilesByExportId').resolves([]);
    const updateTaskExportStub = sinon
      .stub(TaskExportRepository.prototype, 'updateTaskExport')
      .resolves(buildTaskExport({ prefect_flow_run_id: '00000000-0000-4000-8000-000000000006' }));
    const submitTaskExportStub = sinon.stub(PrefectService.prototype, 'submitTaskExport').resolves({
      deploymentId: '00000000-0000-4000-8000-000000000007',
      flowRunId: '00000000-0000-4000-8000-000000000006'
    });

    const taskExport = await new TaskExportService(getMockDBConnection()).dispatchQueuedExport(EXPORT_ID);

    expect(taskExport.task_export_id).to.equal(EXPORT_ID);
    expect(taskExport.files).to.deep.equal([]);
    expect(submitTaskExportStub).to.have.been.calledOnceWith(EXPORT_ID, 1);
    expect(updateTaskExportStub).to.have.been.calledOnceWith(EXPORT_ID, {
      prefect_flow_run_id: '00000000-0000-4000-8000-000000000006',
      prefect_deployment_id: '00000000-0000-4000-8000-000000000007'
    });
  });

  it('records dispatch failure on the durable export', async () => {
    sinon.stub(TaskExportRepository.prototype, 'getTaskExportForUpdate').resolves(buildTaskExport());
    sinon.stub(PrefectService.prototype, 'submitTaskExport').rejects(new Error('Prefect unavailable'));
    const update = sinon.stub(TaskExportRepository.prototype, 'updateTaskExport').resolves(buildTaskExport());

    try {
      await new TaskExportService(getMockDBConnection()).dispatchQueuedExport(EXPORT_ID);
      expect.fail('Expected dispatch to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('Prefect unavailable');
      expect(update).to.have.been.calledOnceWith(EXPORT_ID, {
        status: 'failed',
        failure_code: 'dispatch_failed',
        failure_message: 'Prefect unavailable'
      });
    }
  });

  it('does not redispatch an export already running', async () => {
    sinon
      .stub(TaskExportRepository.prototype, 'getTaskExportForUpdate')
      .resolves(buildTaskExport({ status: 'running' }));
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFilesByExportId').resolves([]);
    const submit = sinon.stub(PrefectService.prototype, 'submitTaskExport');

    await new TaskExportService(getMockDBConnection()).dispatchQueuedExport(EXPORT_ID);

    expect(submit).not.to.have.been.called;
  });

  it('rejects geodatabase exports until an ESRI worker is implemented', async () => {
    try {
      await new TaskExportService(getMockDBConnection()).createQueuedExport(TASK_RUN_ID, 'geodatabase');
      expect.fail('Expected geodatabase export creation to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('ESRI geodatabase exports are not implemented yet.');
    }
  });

  it('rejects stale worker export status callbacks', async () => {
    sinon.stub(TaskExportRepository.prototype, 'getTaskExportForUpdate').resolves(buildTaskExport({ attempt: 2 }));
    const updateTaskExportStub = sinon.stub(TaskExportRepository.prototype, 'updateTaskExport');

    try {
      await new TaskExportService(getMockDBConnection()).updateExportFromWorker(EXPORT_ID, 1, { status: 'running' });
      expect.fail('Expected stale callback to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('Ignoring stale export callback for a previous attempt.');
      expect(updateTaskExportStub).not.to.have.been.called;
    }
  });

  it('requires at least one export file before marking an export ready', async () => {
    sinon
      .stub(TaskExportRepository.prototype, 'getTaskExportForUpdate')
      .resolves(buildTaskExport({ status: 'running' }));
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFilesByExportId').resolves([]);
    const updateTaskExportStub = sinon.stub(TaskExportRepository.prototype, 'updateTaskExport');

    try {
      await new TaskExportService(getMockDBConnection()).updateExportFromWorker(EXPORT_ID, 1, { status: 'ready' });
      expect.fail('Expected ready transition to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('An export cannot be ready before at least one file is recorded.');
      expect(updateTaskExportStub).not.to.have.been.called;
    }
  });

  it('creates export file records only for the current running attempt', async () => {
    const file = buildTaskExportFile();
    sinon
      .stub(TaskExportRepository.prototype, 'getTaskExportForUpdate')
      .resolves(buildTaskExport({ status: 'running' }));
    const createFileStub = sinon.stub(TaskExportFileRepository.prototype, 'createTaskExportFile').resolves(file);

    const created = await new TaskExportService(getMockDBConnection()).createExportFileFromWorker(EXPORT_ID, 1, file);

    expect(created).to.equal(file);
    expect(createFileStub).to.have.been.calledOnceWith(file);
  });

  it('returns a presigned URL for a ready export file object key', async () => {
    sinon.stub(TaskExportRepository.prototype, 'getTaskExportById').resolves(buildTaskExport({ status: 'ready' }));
    sinon.stub(TaskExportFileRepository.prototype, 'getTaskExportFileById').resolves(buildTaskExportFile());
    sinon.stub(objectStore, 'getObjectStoreConfig').returns({
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      bucket: 'exports',
      forcePathStyle: true
    });
    const getPresignedObjectUrlStub = sinon
      .stub(objectStore, 'getPresignedObjectUrl')
      .resolves('http://localhost:9000/exports/task-exports/file.tif');

    const download = await new TaskExportService(getMockDBConnection()).getDownloadUrl(TASK_RUN_ID, EXPORT_ID, FILE_ID);

    expect(download).to.deep.equal({
      url: 'http://localhost:9000/exports/task-exports/file.tif',
      expires_in_seconds: 300
    });
    expect(getPresignedObjectUrlStub).to.have.been.calledOnceWith(
      'exports',
      'task-exports/00000000-0000-4000-8000-000000000003/parts/decision_y000000_x000000.tif',
      300
    );
  });
});

function buildTaskRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    task_run_id: TASK_RUN_ID,
    task_id: TASK_ID,
    task_type: 'discrete_optimization',
    analytical_source_id: null,
    execution_method: 'compiled_discrete_optimization',
    execution_method_version: 'highs-csr-discrete-v1',
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
    dispatch_attempts: 0,
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    cancelled_at: null,
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: null,
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
    content_type: 'application/vnd.zarr+json',
    checksum: 'checksum',
    size_bytes: 1,
    cache_key: null,
    manifest: { partitions: [] },
    lineage: {},
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: null,
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
    status: 'queued',
    attempt: 1,
    prefect_flow_run_id: null,
    prefect_deployment_id: null,
    source_checksum: 'checksum',
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
    object_key: 'task-exports/00000000-0000-4000-8000-000000000003/parts/decision_y000000_x000000.tif',
    content_type: 'image/tiff',
    byte_size: 1024,
    checksum: 'checksum',
    row_offset: 0,
    column_offset: 0,
    width: 512,
    height: 512,
    transform: { gdal: [0, 30, 0, 0, 0, -30] },
    metadata: {},
    ...overrides
  };
}
