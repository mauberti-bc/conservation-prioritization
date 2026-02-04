import { useAuthContext } from 'hooks/useContext';
import { useEffect } from 'react';

/**
 * Logout page that triggers OIDC sign-out.
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
