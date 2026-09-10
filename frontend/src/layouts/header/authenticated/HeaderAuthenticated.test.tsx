/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeaderAuthenticated } from './HeaderAuthenticated';

vi.mock('hooks/useContext', () => ({
  useAuthContext: () => ({
    auth: {
      user: {
        profile: {
          name: 'Test User',
        },
      },
      signoutRedirect: vi.fn(),
    },
  }),
}));

vi.mock('hooks/useConservationApi', () => ({
  useConservationApi: () => ({
    profile: {
      getSelf: vi.fn().mockResolvedValue({ role_name: 'admin' }),
    },
  }),
}));

describe('HeaderAuthenticated', () => {
  afterEach(() => {
    cleanup();
  });

  it('links to the tutorial in desktop navigation', () => {
    render(
      <MemoryRouter>
        <HeaderAuthenticated />
      </MemoryRouter>
    );

    expect(screen.getByTestId('menu_tutorial').getAttribute('href')).toBe('/tutorial');
  });

  it('links to the tutorial in mobile navigation', async () => {
    render(
      <MemoryRouter>
        <HeaderAuthenticated />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mobile_header_menu_button'));

    expect((await screen.findByTestId('collapsed_menu_tutorial')).getAttribute('href')).toBe('/tutorial');
  });
});
