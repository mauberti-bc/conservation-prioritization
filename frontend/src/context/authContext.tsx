import { CircularProgress, Stack } from '@mui/material';
import axios from 'axios';
import React, { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { useConfigContext } from 'hooks/useContext';
import { buildUrl } from 'utils/util';

export interface IAuth {
  /**
   * The logged in user's Keycloak information.
   *
   * @type {AuthContextProps}
   * @memberof IAuth
   */
  auth: AuthContextProps;
  /**
   * Attempts to return a valid access token, performing a silent renew if needed.
   *
   * Renewal failures are logged and returned as null.
   *
   * @param {boolean} [forceRenew=false] Renew even when the current token has not expired, such as after a 401.
   * @returns {Promise<string | null>} The access token, or null if renewal fails or returns no token.
   * @memberof IAuth
   */
  getValidAccessToken: (forceRenew?: boolean) => Promise<string | null>;
}

export const AuthContext = React.createContext<IAuth | undefined>(undefined);

/**
 * Provides authentication state and token recovery, waiting for profile registration before rendering signed-in content.
 *
 * Registration failures retry automatically behind the loading guard; signed-out content renders without registration.
 *
 * @param {PropsWithChildren} props The application content that consumes the authentication context.
 * @returns {React.JSX.Element} The context provider or a registration loading guard.
 */
export const AuthContextProvider = (props: PropsWithChildren) => {
  const auth = useAuth();
  const config = useConfigContext();
  const [registeredProfile, setRegisteredProfile] = useState<string | null>(null);
  const [registrationFailed, setRegistrationFailed] = useState(false);
  const [registrationAttempt, setRegistrationAttempt] = useState(0);
  const registrationKeyRef = useRef<string | null>(null);
  const registrationRef = useRef<Promise<void> | null>(null);
  const accessToken = auth.user?.access_token;
  const profileKey = auth.isAuthenticated && auth.user ? `${config.API_HOST}:${auth.user.profile.sub}` : null;

  /**
   * Returns the current access token when valid, or silently renews an expired, missing, or rejected token.
   *
   * Renewal failures are logged and returned as null so callers can handle an unavailable session.
   *
   * @param {boolean} [forceRenew=false] Force renewal after an API rejection even if the token has not expired locally.
   * @returns {Promise<string | null>} The current or renewed access token, or null if renewal fails or returns no token.
   */
  const getValidAccessToken = useCallback(
    async (forceRenew = false): Promise<string | null> => {
      if (!forceRenew && auth.user?.access_token && !auth.user.expired) {
        return auth.user.access_token;
      }

      try {
        const refreshedUser = await auth.signinSilent();
        return refreshedUser?.access_token ?? null;
      } catch (error) {
        console.error('Silent renew failed', error);
        return null;
      }
    },
    [auth]
  );

  // Add event listener for silent renew errors
  useEffect(() => {
    /**
     * Logs a silent renewal failure reported by the authentication provider.
     *
     * @param {Error} [error] The renewal error supplied by the authentication event.
     * @returns {void}
     */
    const handleSilentRenewError = (error?: Error) => {
      console.error('Silent renew error', error);
    };

    auth.events.addSilentRenewError(handleSilentRenewError);

    return () => {
      auth.events.removeSilentRenewError(handleSilentRenewError);
    };
  }, [auth]);

  useEffect(() => {
    if (!profileKey) {
      setRegisteredProfile(null);
      setRegistrationFailed(false);
      registrationKeyRef.current = null;
      registrationRef.current = null;
      return;
    }

    if (!accessToken || registeredProfile === profileKey) {
      return;
    }

    let cancelled = false;
    setRegistrationFailed(false);

    /**
     * Registers or updates the signed-in profile using the access token captured by this effect.
     *
     * @returns {Promise<void>} Resolves when the API confirms profile registration.
     * @throws {Error} Rejects if the registration request fails.
     */
    const registerProfile = async (): Promise<void> => {
      await axios.put(
        buildUrl(config.API_HOST, 'api/profile/self'),
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    };

    // Reuse the request when React replays effects or a token changes during registration.
    if (registrationKeyRef.current !== profileKey || !registrationRef.current) {
      registrationKeyRef.current = profileKey;
      registrationRef.current = registerProfile();
    }
    const registration = registrationRef.current;

    /**
     * Waits for the shared registration request and updates registration state for the current session.
     *
     * Ignores results after effect cleanup. Active-session failures are logged and enable a retry
     * without rejecting this promise.
     *
     * @returns {Promise<void>} Resolves after registration succeeds or its failure has been handled.
     */
    const finishRegistration = async (): Promise<void> => {
      try {
        await registration;
        if (!cancelled) {
          setRegisteredProfile(profileKey);
        }
      } catch (error) {
        if (!cancelled) {
          registrationRef.current = null;
          setRegistrationFailed(true);
          console.error('Failed to register profile on login', error);
        }
      }
    };

    void finishRegistration();
    return () => {
      cancelled = true;
    };
  }, [profileKey, accessToken, config.API_HOST, registeredProfile, registrationAttempt]);

  useEffect(() => {
    if (!registrationFailed || !profileKey) {
      return;
    }

    const retryTimeout = window.setTimeout(() => {
      setRegistrationAttempt((attempt) => attempt + 1);
    }, 3000);

    return () => {
      window.clearTimeout(retryTimeout);
    };
  }, [registrationFailed, profileKey]);

  if (profileKey && registeredProfile !== profileKey) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress size={64} aria-label="Finishing sign in" />
      </Stack>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        getValidAccessToken,
      }}>
      {props.children}
    </AuthContext.Provider>
  );
};
