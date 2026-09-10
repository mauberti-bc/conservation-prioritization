/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomPagination } from './CustomPagination';

describe('CustomPagination', () => {
  it('renders the current item range and page controls', () => {
    render(
      <CustomPagination
        currentPage={2}
        pageSize={25}
        totalCount={77}
        lastPage={4}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('26-50 of 77')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeTruthy();
  });

  it('calls the page change handler with the selected page', () => {
    const onPageChange = vi.fn();

    render(
      <CustomPagination
        currentPage={2}
        pageSize={25}
        totalCount={77}
        lastPage={4}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
