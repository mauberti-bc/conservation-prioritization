/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskExportFormatDialog } from './TaskExportFormatDialog';

describe('TaskExportFormatDialog', () => {
  it('submits the selected export format', () => {
    const onSubmit = vi.fn();

    render(<TaskExportFormatDialog open isSubmitting={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'GeoTIFF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Geodatabase' }));

    expect(onSubmit).toHaveBeenCalledWith('geotiff');
    expect(onSubmit).toHaveBeenCalledWith('geodatabase');
  });

  it('displays export creation errors', () => {
    render(
      <TaskExportFormatDialog
        open
        isSubmitting={false}
        error="ESRI geodatabase exports are not implemented yet."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('ESRI geodatabase exports are not implemented yet.')).toBeTruthy();
  });
});
