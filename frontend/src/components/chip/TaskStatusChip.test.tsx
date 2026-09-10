/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskStatusChip } from './TaskStatusChip';

describe('TaskStatusChip', () => {
  afterEach(cleanup);

  it.each(['running', 'in_progress'] as const)('shows a spinner for %s', (status) => {
    const { container } = render(<TaskStatusChip status={status} />);
    expect(screen.getByRole('progressbar', { name: 'Task running' })).toBeTruthy();
    expect(container.querySelector('.MuiChip-colorInfo')).toBeTruthy();
  });

  it.each(['pending', 'submitted'] as const)('shows the waiting icon for %s', (status) => {
    render(<TaskStatusChip status={status} />);
    expect(screen.getByTitle('Task waiting')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows aborted without an activity indicator', () => {
    const { container } = render(<TaskStatusChip status="aborted" />);
    expect(screen.getByText('Aborted')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(container.querySelector('.MuiChip-icon')).toBeNull();
  });

  it('shows success without an icon when completed', () => {
    const { container } = render(<TaskStatusChip status="completed" />);
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(container.querySelector('.MuiChip-colorSuccess')).toBeTruthy();
    expect(container.querySelector('.MuiChip-icon')).toBeNull();
  });
});
