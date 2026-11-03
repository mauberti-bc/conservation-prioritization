/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorialPage } from './TutorialPage';

const mocks = vi.hoisted(() => ({
  markdownApi: {
    getMarkdown: vi.fn(),
  },
}));

vi.mock('hooks/useConservationApi', () => ({
  useConservationApi: () => ({
    markdown: mocks.markdownApi,
  }),
}));

describe('TutorialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markdownApi.getMarkdown.mockResolvedValue({
      key: 'tutorial',
      data: '# Tutorial\n\nWelcome to the Conservation Prioritization Tool.\n\n- Define an area of interest',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and renders the tutorial Markdown document', async () => {
    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('progressbar', { name: 'Loading tutorial' })).toBeTruthy();
    await waitFor(() => expect(mocks.markdownApi.getMarkdown).toHaveBeenCalledWith('tutorial'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tutorial' })).toBeTruthy();
    expect(screen.getByText('Welcome to the Conservation Prioritization Tool.')).toBeTruthy();
    expect(screen.getByText('Define an area of interest')).toBeTruthy();
  });

  it('shows an error state when the tutorial cannot be loaded', async () => {
    mocks.markdownApi.getMarkdown.mockRejectedValue(new Error('Unavailable'));

    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Unable to load the tutorial. Please try again.')).toBeTruthy();
  });
});
