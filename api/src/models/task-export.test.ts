import { expect } from 'chai';
import { describe } from 'mocha';
import { TaskExport, TaskExportFormat } from './task-export';
import { TaskExportFile } from './task-export-file';

describe('task export models', () => {
  it('supports GeoTIFF and ESRI geodatabase export formats', () => {
    expect(TaskExportFormat.parse('geotiff')).to.equal('geotiff');
    expect(TaskExportFormat.parse('geodatabase')).to.equal('geodatabase');
  });

  it('omits audit columns from the task export read model', () => {
    const parsed = TaskExport.parse({
      task_export_id: '00000000-0000-4000-8000-000000000001',
      task_run_id: '00000000-0000-4000-8000-000000000002',
      source_artifact_id: '00000000-0000-4000-8000-000000000003',
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
      created_at: '2026-09-09T00:00:00Z',
      updated_at: null,
      created_by: '00000000-0000-4000-8000-000000000004',
      updated_by: null
    });

    expect(parsed).not.to.have.property('created_at');
    expect(parsed).not.to.have.property('updated_at');
    expect(parsed).not.to.have.property('created_by');
    expect(parsed).not.to.have.property('updated_by');
  });

  it('omits audit columns from the task export file read model', () => {
    const parsed = TaskExportFile.parse({
      task_export_file_id: '00000000-0000-4000-8000-000000000001',
      task_export_id: '00000000-0000-4000-8000-000000000002',
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
      created_at: '2026-09-09T00:00:00Z',
      updated_at: null,
      created_by: '00000000-0000-4000-8000-000000000004',
      updated_by: null
    });

    expect(parsed).not.to.have.property('created_at');
    expect(parsed).not.to.have.property('updated_at');
    expect(parsed).not.to.have.property('created_by');
    expect(parsed).not.to.have.property('updated_by');
  });
});
