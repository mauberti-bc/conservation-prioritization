import { CircularProgress, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { AuthContextProvider } from 'context/authContext';
import { ConfigContext, ConfigContextProvider } from 'context/configContext';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthContext, AuthProvider, AuthProviderProps } from 'react-oidc-context';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from 'router/AppRouter';
import { appTheme } from 'theme/AppTheme';
import { buildUrl, ensureProtocol } from 'utils/util';

const App = () => {
  return (
    <>
      {/* CSS Baseline to reset default css */}
      <CssBaseline />
      <BrowserRouter>
        <ThemeProvider theme={appTheme}>
          <ConfigContextProvider>
            <ConfigContext.Consumer>
              {(config) => {
                return (
                  <LoadingGuard
                    isLoading={!config}
                    isLoadingFallback={<CircularProgress className="pageProgress" size={40} />}>
                    {(() => {
                      const keycloakAuthorityConfig = config?.KEYCLOAK_CONFIG.authority ?? '';
                      const keycloakRealm = config?.KEYCLOAK_CONFIG.realm ?? '';
                      const normalizedAuthority = keycloakAuthorityConfig
                        ? ensureProtocol(keycloakAuthorityConfig, 'https://')
                        : '';
                      const authority = normalizedAuthority.includes('/realms/')
                        ? normalizedAuthority
                        : buildUrl(normalizedAuthority, `realms/${keycloakRealm}/`);
                      const redirectUri = buildUrl(window.location.origin, 'auth/login');
                      const logoutRedirectUri = config?.SITEMINDER_LOGOUT_URL
                        ? `${config.SITEMINDER_LOGOUT_URL}?returl=${window.location.origin}&retnow=1`
                        : buildUrl(window.location.origin);

                      const authConfig: AuthProviderProps = {
                        authority,
                        client_id: config?.KEYCLOAK_CONFIG.clientId ?? '',
                        resource: config?.KEYCLOAK_CONFIG.clientId ?? '',
                        // Automatically renew the access token before it expires
                        automaticSilentRenew: true,
                        // Default sign in redirect
                        redirect_uri: redirectUri,
                        // Default sign out redirect
                        post_logout_redirect_uri: logoutRedirectUri,
                        // Automatically load additional user profile information
                        loadUserInfo: true,
                        userStore: new WebStorageStateStore({ store: window.localStorage }),
                        onSigninCallback: (_): void => {
                          // See https://github.com/authts/react-oidc-context#getting-started
                          window.history.replaceState({}, document.title, '/');
                        },
                      };

                      return (
                        <AuthProvider {...authConfig}>
                          <AuthContextProvider>
                            <AuthContext.Consumer>
                              {(authState) => {
                                return (
                                  <LoadingGuard
                                    isLoading={!authState}
                                    isLoadingFallback={<CircularProgress className="pageProgress" size={40} />}>
                                    <AppRouter />
                                  </LoadingGuard>
                                );
                              }}
                            </AuthContext.Consumer>
                          </AuthContextProvider>
                        </AuthProvider>
                      );
                    })()}
                  </LoadingGuard>
                );
              }}
            </ConfigContext.Consumer>
          </ConfigContextProvider>
        </ThemeProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
