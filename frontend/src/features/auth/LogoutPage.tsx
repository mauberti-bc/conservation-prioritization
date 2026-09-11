import { useAuthContext } from 'hooks/useContext';
import { useEffect } from 'react';

/**
 * Logout page that triggers OIDC sign-out.
 *
 * @returns {React.ReactNode} The rendered component.
 */
export const LogoutPage = () => {
  const authContext = useAuthContext();

  useEffect(() => {
    if (!authContext.auth.isLoading) {
      void authContext.auth.signoutRedirect();
    }
  }, [authContext.auth.isLoading, authContext.auth]);

  return null;
};
