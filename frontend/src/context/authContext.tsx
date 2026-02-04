import axios from 'axios';
import React, { PropsWithChildren, useEffect, useRef } from 'react';
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
}

export const AuthContext = React.createContext<IAuth | undefined>(undefined);

/**
 * Provides access to user and authentication (keycloak) data about the logged in user.
 *
 * @param {*} props
 * @return {*}
 */
export const AuthContextProvider = (props: PropsWithChildren) => {
  const auth = useAuth();
  const config = useConfigContext();
  const lastRegisteredTokenRef = useRef<string | null>(null);

  // Add event listener for silent renew errors
  useEffect(() => {
    auth.events.addSilentRenewError(() => {
      // If the silent renew fails, ensure the user is signed out and redirect to the home page
      auth.signoutRedirect();
    });
  }, [auth]);

  useEffect(() => {
    const accessToken = auth.user?.access_token;

    if (!auth.isAuthenticated || !accessToken) {
      return;
    }

    if (lastRegisteredTokenRef.current === accessToken) {
      return;
    }

    lastRegisteredTokenRef.current = accessToken;

    const registerProfile = async () => {
      try {
        const url = buildUrl(config.API_HOST, 'api/profile/self');
        await axios.put(
          url,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
      } catch (error) {
        console.error('Failed to register profile on login', error);
      }
    };

    void registerProfile();
  }, [auth.isAuthenticated, auth.user?.access_token, config.API_HOST]);

  return (
    <AuthContext.Provider
      value={{
        auth,
      }}>
      {props.children}
    </AuthContext.Provider>
  );
};
