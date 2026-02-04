import React, { PropsWithChildren } from 'react';
import { AuthContextProps, useAuth } from 'react-oidc-context';

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

  // Add event listener for silent renew errors
  auth.events.addSilentRenewError(() => {
    // If the silent renew fails, ensure the user is signed out and redirect to the home page
    auth.signoutRedirect();
  });

  return (
    <AuthContext.Provider
      value={{
        auth,
      }}>
      {props.children}
    </AuthContext.Provider>
  );
};
