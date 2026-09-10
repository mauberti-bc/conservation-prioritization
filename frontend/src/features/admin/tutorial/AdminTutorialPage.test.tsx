/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminTutorialPage } from './AdminTutorialPage';

const mocks = vi.hoisted(() => ({
  markdownApi: {
    getAdminMarkdown: vi.fn(),
    getAdminMarkdownById: vi.fn(),
    createAdminMarkdown: vi.fn(),
    updateAdminMarkdown: vi.fn(),
    deleteAdminMarkdown: vi.fn(),
  },
  dialogContext: {
    setSnackbar: vi.fn(),
    setYesNoDialog: vi.fn(),
  },
}));

vi.mock('hooks/useConservationApi', () => ({
  useConservationApi: () => ({
    markdown: mocks.markdownApi,
  }),
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => mocks.dialogContext,
}));

vi.mock('@mui/x-data-grid', async () => {
  const actual = await vi.importActual<any>('@mui/x-data-grid');

  return {
    ...actual,
    DataGrid: ({ rows, columns, getRowId, loading }: any) => (
      <div>
        {loading && <div role="progressbar" aria-label="Loading Markdown records" />}
        {rows.map((row: any) => (
          <div key={getRowId(row)} data-testid={`markdown-row-${row.markdown_id}`}>
            {columns.map((column: any) => (
              <div key={column.field}>{column.renderCell ? column.renderCell({ row }) : row[column.field]}</div>
            ))}
          </div>
        ))}
      </div>
    ),
  };
});

describe('AdminTutorialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markdownApi.getAdminMarkdown.mockResolvedValue({
      markdown: [
        {
          markdown_id: 'tutorial-id',
          key: 'tutorial',
          preview: '# Tutorial',
          created_at: '2026-09-10T00:00:00.000Z',
          created_by: null,
          updated_at: null,
          updated_by: null,
        },
      ],
      pagination: { total: 1, current_page: 1, last_page: 1 },
    });
    mocks.markdownApi.getAdminMarkdownById.mockResolvedValue({
      markdown_id: 'tutorial-id',
      key: 'tutorial',
      data: '# Tutorial',
      created_at: '2026-09-10T00:00:00.000Z',
      created_by: null,
      updated_at: null,
      updated_by: null,
    });
    mocks.markdownApi.createAdminMarkdown.mockResolvedValue({
      markdown_id: 'new-id',
      key: 'getting-started',
      data: '# Conservation planning workflow',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads Markdown rows and protects the tutorial key from deletion', async () => {
    render(<AdminTutorialPage />);

    await waitFor(() => expect(mocks.markdownApi.getAdminMarkdown).toHaveBeenCalledWith(expect.any(Object)));
    expect(await screen.findByText('tutorial')).toBeTruthy();

    const deleteButton = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);
  });

  it('creates a Markdown record through the admin API', async () => {
    render(<AdminTutorialPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Markdown' }));
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'getting-started' } });
    fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: '# Conservation planning workflow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.markdownApi.createAdminMarkdown).toHaveBeenCalledWith({
        key: 'getting-started',
        data: '# Conservation planning workflow',
      })
    );
  });
});
