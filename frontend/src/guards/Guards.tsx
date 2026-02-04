import { useAuthContext } from 'hooks/useContext';
import { PropsWithChildren, ReactElement } from 'react';

interface IGuardProps {
  /**
   * An optional backup ReactElement to render if the guard fails.
   *
   * @type {ReactElement}
   * @memberof IGuardProps
   */
  fallback?: ReactElement;
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
