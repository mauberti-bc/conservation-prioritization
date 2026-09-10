import { OpenAPIV3 } from 'openapi-types';

export const TaskExportFileSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'task_export_file_id',
    'task_export_id',
    'part_index',
    'filename',
    'content_type',
    'byte_size',
    'checksum',
    'row_offset',
    'column_offset',
    'width',
    'height',
    'transform',
    'metadata'
  ],
  properties: {
    task_export_file_id: { type: 'string', format: 'uuid' },
    task_export_id: { type: 'string', format: 'uuid' },
    part_index: { type: 'integer' },
    filename: { type: 'string' },
    object_key: { type: 'string' },
    content_type: { type: 'string' },
    byte_size: { type: 'integer', format: 'int64' },
    checksum: { type: 'string' },
    row_offset: { type: 'integer' },
    column_offset: { type: 'integer' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    transform: { type: 'object', additionalProperties: true },
    metadata: { type: 'object', additionalProperties: true }
  }
};

export const TaskExportSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'task_export_id',
    'task_run_id',
    'source_artifact_id',
    'format',
    'format_version',
    'status',
    'attempt',
    'specification',
    'progress',
    'files'
  ],
  properties: {
    task_export_id: { type: 'string', format: 'uuid' },
    task_run_id: { type: 'string', format: 'uuid' },
    source_artifact_id: { type: 'string', format: 'uuid' },
    format: { type: 'string', enum: ['geotiff', 'geodatabase'] },
    format_version: { type: 'string' },
    status: { type: 'string', enum: ['queued', 'running', 'ready', 'failed'] },
    attempt: { type: 'integer' },
    prefect_flow_run_id: { type: 'string', format: 'uuid', nullable: true },
    prefect_deployment_id: { type: 'string', format: 'uuid', nullable: true },
    source_checksum: { type: 'string', nullable: true },
    specification: { type: 'object', additionalProperties: true },
    progress: { type: 'object', additionalProperties: true },
    resource_admission: { type: 'object', additionalProperties: true, nullable: true },
    failure_code: { type: 'string', nullable: true },
    failure_message: { type: 'string', nullable: true },
    started_at: { type: 'string', nullable: true },
    completed_at: { type: 'string', nullable: true },
    failed_at: { type: 'string', nullable: true },
    files: {
      type: 'array',
      items: TaskExportFileSchema
    }
  }
};

export const TaskExportDownloadSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['url', 'expires_in_seconds'],
  properties: {
    url: { type: 'string' },
    expires_in_seconds: { type: 'integer' }
  }
};
