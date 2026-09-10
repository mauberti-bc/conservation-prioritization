/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TASK_STATUS } from 'constants/status';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskViewPanelHeader } from './TaskViewPanelHeader';

describe('TaskViewPanelHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls abort from the task menu', () => {
    const onAbort = vi.fn();
    render(
      <TaskViewPanelHeader
        title="Task"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onAbort={onAbort}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'menu options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Abort' }));
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it('renders abort first for tasks that are not completed', () => {
    render(
      <TaskViewPanelHeader
        title="Task"
        status={TASK_STATUS.RUNNING}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onAbort={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'menu options' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Abort',
      'Edit',
      'Share',
      'Delete',
    ]);
  });

  it.each([TASK_STATUS.COMPLETED, TASK_STATUS.ABORTED])('does not render abort for %s tasks', (status) => {
    render(
      <TaskViewPanelHeader
        title="Task"
        status={status}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onAbort={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'menu options' }));

    expect(screen.queryByRole('menuitem', { name: 'Abort' })).toBeNull();
  });

  it('calls the close handler from the header close button', () => {
    const onClose = vi.fn();

    render(
      <TaskViewPanelHeader
        title="Task"
        onClose={onClose}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onAbort={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close task' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
