import { describe, expect, it, vi } from 'vitest';
import { useMarkdownApi } from './useMarkdownApi';

describe('useMarkdownApi', () => {
  it('gets Markdown by key', async () => {
    const get = vi.fn().mockResolvedValue({ data: { key: 'tutorial', data: '# Tutorial' } });

    const response = await useMarkdownApi({ get } as any).getMarkdown('tutorial');

    expect(response).toEqual({ key: 'tutorial', data: '# Tutorial' });
    expect(get).toHaveBeenCalledWith('/api/markdown/tutorial');
  });

  it('lists admin Markdown with pagination options', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: { markdown: [], pagination: { total: 0, current_page: 1, last_page: 1 } } });

    await useMarkdownApi({ get } as any).getAdminMarkdown({ page: 1, limit: 25, sort: 'key', order: 'asc' });

    expect(get).toHaveBeenCalledWith(
      '/api/admin/markdown',
      expect.objectContaining({
        params: { page: 1, limit: 25, sort: 'key', order: 'asc' },
      })
    );
  });

  it('uses admin Markdown CRUD routes', async () => {
    const get = vi.fn().mockResolvedValue({ data: { markdown_id: 'id', key: 'tutorial', data: '# Tutorial' } });
    const post = vi.fn().mockResolvedValue({ data: { markdown_id: 'id', key: 'new-doc', data: '# New' } });
    const put = vi.fn().mockResolvedValue({ data: { markdown_id: 'id', key: 'new-doc', data: '# Updated' } });
    const del = vi.fn().mockResolvedValue({});
    const api = useMarkdownApi({ get, post, put, delete: del } as any);

    await api.getAdminMarkdownById('id');
    await api.createAdminMarkdown({ key: 'new-doc', data: '# New' });
    await api.updateAdminMarkdown('id', { data: '# Updated' });
    await api.deleteAdminMarkdown('id');

    expect(get).toHaveBeenCalledWith('/api/admin/markdown/id');
    expect(post).toHaveBeenCalledWith('/api/admin/markdown', { key: 'new-doc', data: '# New' });
    expect(put).toHaveBeenCalledWith('/api/admin/markdown/id', { data: '# Updated' });
    expect(del).toHaveBeenCalledWith('/api/admin/markdown/id');
  });
});
