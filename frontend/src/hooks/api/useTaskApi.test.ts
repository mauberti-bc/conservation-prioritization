import { describe, expect, it, vi } from 'vitest';
import { useTaskApi } from './useTaskApi';

describe('useTaskApi task export methods', () => {
  it('creates task exports with the selected format', async () => {
    const post = vi.fn().mockResolvedValue({ data: { task_export_id: 'export-id' } });
    const api = useTaskApi({ post } as any);

    const response = await api.createTaskExport('run-id', { format: 'geotiff' });

    expect(response).toEqual({ task_export_id: 'export-id' });
    expect(post).toHaveBeenCalledWith('/api/run/run-id/export', { format: 'geotiff' });
  });

  it('lists exports for a run', async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ task_export_id: 'export-id' }] });
    const api = useTaskApi({ get } as any);

    const response = await api.getTaskExports('run-id');

    expect(response).toEqual([{ task_export_id: 'export-id' }]);
    expect(get).toHaveBeenCalledWith('/api/run/run-id/export');
  });

  it('gets a presigned URL for one export file', async () => {
    const get = vi.fn().mockResolvedValue({ data: { url: 'https://example.test/file.tif', expires_in_seconds: 300 } });
    const api = useTaskApi({ get } as any);

    const response = await api.getTaskExportFileDownload('run-id', 'export-id', 'file-id');

    expect(response).toEqual({ url: 'https://example.test/file.tif', expires_in_seconds: 300 });
    expect(get).toHaveBeenCalledWith('/api/run/run-id/export/export-id/file/file-id/download');
  });
});
