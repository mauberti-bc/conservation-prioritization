/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TaskExportResponse } from 'hooks/interfaces/useTaskApi.interface';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskExportFormatDialog } from './TaskExportFormatDialog';

describe('TaskExportFormatDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('exports the selected format from each row', () => {
    const onExport = vi.fn();

    render(
      <TaskExportFormatDialog
        open
        exports={[]}
        loadingFormat={null}
        error={null}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onExport={onExport}
      />
    );

    const exportButtons = screen.getAllByRole('button', { name: 'Export' });
    fireEvent.click(exportButtons[0]);
    fireEvent.click(exportButtons[1]);

    expect(onExport).toHaveBeenCalledWith('geotiff');
    expect(onExport).toHaveBeenCalledWith('geodatabase');
  });

  it('downloads a ready export from its row', () => {
    const onDownload = vi.fn();

    render(
      <TaskExportFormatDialog
        open
        exports={[buildExport({ format: 'geotiff', status: 'ready' })]}
        loadingFormat={null}
        error={null}
        onClose={vi.fn()}
        onDownload={onDownload}
        onExport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(onDownload).toHaveBeenCalledWith('geotiff');
  });

  it('only shows loading for the active export format', () => {
    render(
      <TaskExportFormatDialog
        open
        exports={[]}
        loadingFormat="geotiff"
        error={null}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onExport={vi.fn()}
      />
    );

    const exportButtons = screen.getAllByRole('button', { name: 'Export' });

    expect(exportButtons[0].hasAttribute('disabled')).to.equal(true);
    expect(exportButtons[1].hasAttribute('disabled')).to.equal(false);
  });

  it('shows loading for preparing exports without rendering Preparing text', () => {
    render(
      <TaskExportFormatDialog
        open
        exports={[buildExport({ format: 'geodatabase', status: 'running' })]}
        loadingFormat={null}
        error={null}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onExport={vi.fn()}
      />
    );

    expect(screen.queryByText('Preparing')).toBeNull();

    const exportButtons = screen.getAllByRole('button', { name: 'Export' });

    expect(exportButtons[0].hasAttribute('disabled')).to.equal(false);
    expect(exportButtons[1].hasAttribute('disabled')).to.equal(true);
  });

  it('displays export creation errors', () => {
    render(
      <TaskExportFormatDialog
        open
        exports={[]}
        loadingFormat={null}
        error="ESRI geodatabase exports are not implemented yet."
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText('ESRI geodatabase exports are not implemented yet.')).toBeTruthy();
  });

  it('closes from the header close button without rendering footer actions', () => {
    const onClose = vi.fn();

    render(
      <TaskExportFormatDialog
        open
        exports={[]}
        loadingFormat={null}
        error={null}
        onClose={onClose}
        onDownload={vi.fn()}
        onExport={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

function buildExport(overrides: Partial<TaskExportResponse> = {}): TaskExportResponse {
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
    ...overrides,
  };
}
