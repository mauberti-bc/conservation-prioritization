/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskViewPanelHeader } from './TaskViewPanelHeader';

describe('TaskViewPanelHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls the close handler from the header close button', () => {
    const onClose = vi.fn();

    render(
      <TaskViewPanelHeader title="Task" onClose={onClose} onEdit={vi.fn()} onShare={vi.fn()} onDelete={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close task' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
