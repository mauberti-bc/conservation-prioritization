/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskViewPanelHeader } from './TaskViewPanelHeader';

describe('TaskViewPanelHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls the download handler from the header export button', () => {
    const onDownload = vi.fn();

    render(
      <TaskViewPanelHeader
        title="Task"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onDownload={onDownload}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(onDownload).toHaveBeenCalledOnce();
  });
});
