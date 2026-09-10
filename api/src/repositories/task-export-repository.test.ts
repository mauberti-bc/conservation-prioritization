import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { SQLStatement } from 'sql-template-strings';
import { TaskExport } from '../models/task-export';
import { TaskExportFile } from '../models/task-export-file';
import { getMockDBConnection } from '../__mocks__/db';
import { TaskExportFileRepository } from './task-export-file-repository';
import { TaskExportRepository } from './task-export-repository';

const EXPORT_ID = '00000000-0000-4000-8000-000000000001';
const TASK_RUN_ID = '00000000-0000-4000-8000-000000000002';
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000003';
const FILE_ID = '00000000-0000-4000-8000-000000000004';

describe('TaskExportRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('omits audit columns from task export SELECT columns', async () => {
    const sql = sinon.stub().resolves({ rowCount: 1, rows: [buildTaskExport()] });
    const repository = new TaskExportRepository(getMockDBConnection({ sql }));

    await repository.getTaskExportById(EXPORT_ID);

    const statement = sql.firstCall.args[0] as SQLStatement;
    expect(statement.text).not.to.contain('created_by');
    expect(statement.text).not.to.contain('updated_by');
    expect(statement.text).to.contain('started_at');
    expect(statement.text).to.contain('completed_at');
  });

  it('orders task exports by audit timestamp without reading it', async () => {
    const sql = sinon.stub().resolves({ rowCount: 1, rows: [buildTaskExport()] });
    const repository = new TaskExportRepository(getMockDBConnection({ sql }));

    await repository.getTaskExportsByRunId(TASK_RUN_ID);

    const statement = sql.firstCall.args[0] as SQLStatement;
    expect(statement.text).to.contain('ORDER BY created_at DESC');
    expect(statement.text).not.to.contain('created_at, updated_at');
  });
});

describe('TaskExportFileRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('omits audit columns from task export file SELECT columns', async () => {
    const sql = sinon.stub().resolves({ rowCount: 1, rows: [buildTaskExportFile()] });
    const repository = new TaskExportFileRepository(getMockDBConnection({ sql }));

    await repository.getTaskExportFileById(FILE_ID);

    const statement = sql.firstCall.args[0] as SQLStatement;
    expect(statement.text).not.to.contain('created_by');
    expect(statement.text).not.to.contain('updated_by');
    expect(statement.text).to.contain('object_key');
    expect(statement.text).to.contain('transform');
  });

  it('upserts deterministic export file parts by export and part index', async () => {
    const sql = sinon.stub().resolves({ rowCount: 1, rows: [buildTaskExportFile()] });
    const repository = new TaskExportFileRepository(getMockDBConnection({ sql }));

    await repository.createTaskExportFile(buildTaskExportFile());

    const statement = sql.firstCall.args[0] as SQLStatement;
    expect(statement.text).to.contain('ON CONFLICT (task_export_id, part_index) DO UPDATE');
    expect(statement.text).to.contain('object_key = EXCLUDED.object_key');
  });
});

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
    object_key: 'task-exports/00000000-0000-4000-8000-000000000001/parts/decision_y000000_x000000.tif',
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
