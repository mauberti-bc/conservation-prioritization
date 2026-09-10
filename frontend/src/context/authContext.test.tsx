// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { StrictMode, useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, AuthContextProvider } from './authContext';

const { auth } = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    user: { access_token: 'token', expired: false, profile: { sub: 'user' } },
    signinSilent: vi.fn(),
    events: { addSilentRenewError: vi.fn(), removeSilentRenewError: vi.fn() },
  },
}));
vi.mock('react-oidc-context', () => ({ useAuth: () => auth }));
vi.mock('hooks/useContext', () => ({ useConfigContext: () => ({ API_HOST: 'https://api.example.test' }) }));
vi.mock('axios', () => ({ default: { put: vi.fn() } }));

/**
 * Renders a test control that requests an access token through the authentication context.
 *
 * @param props The token recovery options for this test control.
 * @param {boolean} [props.forceRenew=true] Whether clicking the control forces token renewal.
 * @returns {React.JSX.Element} A button that invokes token recovery.
 */
function Content({ forceRenew = true }: { forceRenew?: boolean }) {
  const context = useContext(AuthContext);
  return (
    <button
      onClick={async () => {
        await context?.getValidAccessToken(forceRenew);
      }}>
      Protected
    </button>
  );
}

describe('profile registration', () => {
  beforeEach(() => {
    auth.isAuthenticated = true;
    auth.user = { access_token: 'token', expired: false, profile: { sub: 'user' } };
    vi.mocked(axios.put).mockResolvedValue({});
    auth.signinSilent.mockResolvedValue({ access_token: 'renewed' });
  });
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('waits for registration before rendering protected content', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(axios.put).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(
      <AuthContextProvider>
        <Content />
      </AuthContextProvider>
    );
    expect(screen.queryByText('Protected')).toBeNull();
    await act(async () => {
      finish({});
    });
    expect(screen.getByText('Protected')).toBeTruthy();
  });

  it('shares registration across StrictMode effect replay', async () => {
    render(
      <StrictMode>
        <AuthContextProvider>
          <Content />
        </AuthContextProvider>
      </StrictMode>
    );
    await screen.findByText('Protected');
    expect(axios.put).toHaveBeenCalledOnce();
  });

  it('allows retrying failed registration with the same token', async () => {
    vi.mocked(axios.put).mockRejectedValueOnce(new Error('Unavailable'));
    render(
      <AuthContextProvider>
        <Content />
      </AuthContextProvider>
    );
    fireEvent.click(await screen.findByText('Retry'));
    expect(await screen.findByText('Protected')).toBeTruthy();
    expect(axios.put).toHaveBeenCalledTimes(2);
  });

  it('renews a rejected token even if its local expiry has not passed', async () => {
    render(
      <AuthContextProvider>
        <Content />
      </AuthContextProvider>
    );
    fireEvent.click(await screen.findByText('Protected'));
    await waitFor(() => expect(auth.signinSilent).toHaveBeenCalledOnce());
  });

  it('renews an expired token without requiring a 401 first', async () => {
    auth.user.expired = true;
    render(
      <AuthContextProvider>
        <Content forceRenew={false} />
      </AuthContextProvider>
    );
    fireEvent.click(await screen.findByText('Protected'));
    await waitFor(() => expect(auth.signinSilent).toHaveBeenCalledOnce());
  });

  it('registers a different account before showing protected content', async () => {
    const view = render(
      <AuthContextProvider>
        <Content />
      </AuthContextProvider>
    );
    await screen.findByText('Protected');
    vi.mocked(axios.put).mockReturnValue(new Promise(() => {}));
    auth.user = { access_token: 'other-token', expired: false, profile: { sub: 'other-user' } };
    view.rerender(
      <AuthContextProvider>
        <Content />
      </AuthContextProvider>
    );
    expect(screen.queryByText('Protected')).toBeNull();
    expect(axios.put).toHaveBeenCalledTimes(2);
  });
});
