import { useAuthContext } from 'hooks/useContext';
import { PropsWithChildren, ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface IGuardProps {
  /**
   * An optional backup ReactElement to render if the guard fails.
   *
   * @type {ReactElement}
   * @memberof IGuardProps
   */
  fallback?: ReactElement;
  redirectTo?: string;
}

/**
 * Renders `props.children` only if the user is not authenticated.
 *
 * @param {*} props
 * @return {*}
 */
export const UnAuthGuard = (props: PropsWithChildren<IGuardProps>) => {
  const authContext = useAuthContext();

  if (authContext.auth.isAuthenticated) {
    if (props.fallback) {
      return <>{props.fallback}</>;
    }

    return <></>;
  }

  return <>{props.children}</>;
};

/**
 * Renders `props.children` only if the user is authenticated.
 *
 * @param {*} props
 * @return {*}
 */
export const AuthGuard = (props: PropsWithChildren<IGuardProps>) => {
  const authContext = useAuthContext();

  if (!authContext.auth.isAuthenticated) {
    if (props.fallback) {
      return <>{props.fallback}</>;
    }

    return <></>;
  }

  return <>{props.children}</>;
};

/**
 * Redirects to /login if the user is not authenticated.
 *
 * @param {*} props
 * @return {*}
 */
export const AuthRedirectGuard = (props: PropsWithChildren<IGuardProps>) => {
  const authContext = useAuthContext();
  const location = useLocation();

  if (authContext.auth.isLoading) {
    return props.fallback ?? <></>;
  }

  if (!authContext.auth.isAuthenticated) {
    if (props.fallback) {
      return <>{props.fallback}</>;
    }

    const redirectTarget = props.redirectTo ?? '/auth/login';
    return <Navigate to={redirectTarget} replace state={{ from: location.pathname }} />;
  }

  return <>{props.children}</>;
};
