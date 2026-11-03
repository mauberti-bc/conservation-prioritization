// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { AxiosError } from 'axios';
import { AuthContext, IAuth } from 'context/authContext';
import { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useAxios from './useAxios';

describe('API token recovery', () => {
  afterEach(cleanup);

  it('sends the renewed token on retry even before auth context updates', async () => {
    const getValidAccessToken = vi.fn().mockResolvedValue('renewed');
    const context = {
      auth: { user: { access_token: 'expired' } },
      getValidAccessToken,
    } as unknown as IAuth;
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
    );
    const { result } = renderHook(() => useAxios('https://api.example.test'), { wrapper });
    const tokens: unknown[] = [];
    result.current.defaults.adapter = async (config) => {
      tokens.push(config.headers.get('Authorization'));
      const response = { config, data: {}, headers: {}, status: tokens.length === 1 ? 401 : 200, statusText: '' };
      if (response.status === 401) {
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response);
      }
      return response;
    };
    await result.current.get('/api/task');
    expect(tokens).toEqual(['Bearer expired', 'Bearer renewed']);
    expect(getValidAccessToken).toHaveBeenCalledWith(true);
  });
});
