import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../database/db';
import { TaskExport } from '../models/task-export';
import { TaskExportFile } from '../models/task-export-file';
import { TaskExportService } from '../services/task-export-service';
import { TaskRunService } from '../services/task-run-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../__mocks__/db';
import { getInternalTaskExport } from './internal/export/{exportId}';
import { createInternalTaskExportFile } from './internal/export/{exportId}/file';
import { updateInternalTaskExport } from './internal/export/{exportId}/status';
import { createTaskExport, getTaskExports } from './run/{runId}/export';
import { getTaskExport } from './run/{runId}/export/{exportId}';
import { getTaskExportFileDownload } from './run/{runId}/export/{exportId}/file/{exportFileId}/download';

chai.use(sinonChai);

const TASK_RUN_ID = '00000000-0000-4000-8000-000000000001';
const EXPORT_ID = '00000000-0000-4000-8000-000000000002';
const FILE_ID = '00000000-0000-4000-8000-000000000003';

describe('task export path handlers', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('lists exports for an authorized run', async () => {
    const connection = registerUserConnection();
    const taskExport = buildTaskExport();
    sinon.stub(TaskExportService.prototype, 'getTaskExportsByRunId').resolves([taskExport]);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { runId: TASK_RUN_ID };

    await getTaskExports()(mockReq, mockRes, sinon.fake());

    expect(connection.open).to.have.been.calledOnce;
    expect(connection.commit).to.have.been.calledOnce;
    expect(mockRes.status).to.have.been.calledOnceWith(200);
    expect(mockRes.json).to.have.been.calledOnceWith([taskExport]);
  });

  it('creates an export with the requested format', async () => {
    const connection = registerUserConnection();
    const createQueuedExportStub = sinon
      .stub(TaskExportService.prototype, 'createQueuedExport')
      .resolves(buildTaskExport());
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { runId: TASK_RUN_ID };
    mockReq.body = { format: 'geotiff' };

    await createTaskExport()(mockReq, mockRes, sinon.fake());

    expect(connection.commit).to.have.been.calledOnce;
    expect(createQueuedExportStub).to.have.been.calledOnceWith(TASK_RUN_ID, 'geotiff');
    expect(mockRes.status).to.have.been.calledOnceWith(201);
  });

  it('returns one export only through the run-scoped service method', async () => {
    registerUserConnection();
    const getTaskExportByRunIdStub = sinon
      .stub(TaskExportService.prototype, 'getTaskExportByRunId')
      .resolves(buildTaskExport());
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { runId: TASK_RUN_ID, exportId: EXPORT_ID };

    await getTaskExport()(mockReq, mockRes, sinon.fake());

    expect(getTaskExportByRunIdStub).to.have.been.calledOnceWith(TASK_RUN_ID, EXPORT_ID);
    expect(mockRes.status).to.have.been.calledOnceWith(200);
  });

  it('returns a presigned download response for one export file', async () => {
    registerUserConnection();
    const download = { url: 'http://download.example/file.tif', expires_in_seconds: 300 };
    const getDownloadUrlStub = sinon.stub(TaskExportService.prototype, 'getDownloadUrl').resolves(download);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { runId: TASK_RUN_ID, exportId: EXPORT_ID, exportFileId: FILE_ID };

    await getTaskExportFileDownload()(mockReq, mockRes, sinon.fake());

    expect(getDownloadUrlStub).to.have.been.calledOnceWith(TASK_RUN_ID, EXPORT_ID, FILE_ID);
    expect(mockRes.json).to.have.been.calledOnceWith(download);
  });

  it('returns internal export execution context', async () => {
    registerAPIConnection();
    const taskExport = buildTaskExport();
    const run = { task_run_id: TASK_RUN_ID };
    sinon.stub(TaskExportService.prototype, 'getTaskExportById').resolves(taskExport);
    sinon.stub(TaskRunService.prototype, 'getTaskRunById').resolves(run as any);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { exportId: EXPORT_ID };

    await getInternalTaskExport()(mockReq, mockRes, sinon.fake());

    expect(mockRes.json).to.have.been.calledOnceWith({ export: taskExport, run });
  });

  it('applies internal status updates with the request attempt', async () => {
    registerAPIConnection();
    const updateExportFromWorkerStub = sinon
      .stub(TaskExportService.prototype, 'updateExportFromWorker')
      .resolves(buildTaskExport());
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { exportId: EXPORT_ID };
    mockReq.body = { attempt: 2, status: 'running' };

    await updateInternalTaskExport()(mockReq, mockRes, sinon.fake());

    expect(updateExportFromWorkerStub).to.have.been.calledOnceWith(EXPORT_ID, 2, mockReq.body);
    expect(mockRes.json).to.have.been.calledOnceWith({ ok: true });
  });

  it('records internal export files using the path export ID', async () => {
    registerAPIConnection();
    const file = buildTaskExportFile();
    const createExportFileFromWorkerStub = sinon
      .stub(TaskExportService.prototype, 'createExportFileFromWorker')
      .resolves(file);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { exportId: EXPORT_ID };
    mockReq.body = { ...file, attempt: 3, task_export_id: 'wrong-export-id' };

    await createInternalTaskExportFile()(mockReq, mockRes, sinon.fake());

    expect(createExportFileFromWorkerStub.firstCall.args[0]).to.equal(EXPORT_ID);
    expect(createExportFileFromWorkerStub.firstCall.args[1]).to.equal(3);
    expect(createExportFileFromWorkerStub.firstCall.args[2].task_export_id).to.equal(EXPORT_ID);
    expect(mockRes.status).to.have.been.calledOnceWith(200);
  });
});

function registerUserConnection() {
  const connection = getMockDBConnection({
    open: sinon.stub().resolves(),
    commit: sinon.stub().resolves(),
    rollback: sinon.stub().resolves(),
    release: sinon.stub()
  });
  sinon.stub(db, 'getDBConnection').returns(connection);
  return connection;
}

function registerAPIConnection() {
  const connection = getMockDBConnection({
    open: sinon.stub().resolves(),
    commit: sinon.stub().resolves(),
    rollback: sinon.stub().resolves(),
    release: sinon.stub()
  });
  sinon.stub(db, 'getAPIUserDBConnection').returns(connection);
  return connection;
}

function buildTaskExport(overrides: Partial<TaskExport> = {}): TaskExport & { files: TaskExportFile[] } {
  return {
    task_export_id: EXPORT_ID,
    task_run_id: TASK_RUN_ID,
    source_artifact_id: '00000000-0000-4000-8000-000000000004',
    format: 'geotiff',
    format_version: 'geotiff-v1',
    status: 'queued',
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
    ...overrides
  };
}

function buildTaskExportFile(overrides: Partial<TaskExportFile> = {}): TaskExportFile {
  return {
    task_export_file_id: FILE_ID,
    task_export_id: EXPORT_ID,
    part_index: 0,
    filename: 'decision_y000000_x000000.tif',
    object_key: 'task-exports/00000000-0000-4000-8000-000000000002/parts/decision_y000000_x000000.tif',
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
