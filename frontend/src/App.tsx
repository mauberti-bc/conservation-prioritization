import { CircularProgress, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { AuthContextProvider } from 'context/authContext';
import { ConfigContext, ConfigContextProvider } from 'context/configContext';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthContext, AuthProvider, AuthProviderProps } from 'react-oidc-context';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from 'router/AppRouter';
import { appTheme } from 'theme/AppTheme';
import { buildUrl } from 'utils/util';

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
                if (!config) {
                  return <CircularProgress className="pageProgress" size={40} />;
                }

                const logoutRedirectUri = config.SITEMINDER_LOGOUT_URL
                  ? `${config.SITEMINDER_LOGOUT_URL}?returl=${window.location.origin}&retnow=1`
                  : buildUrl(window.location.origin);

                const authConfig: AuthProviderProps = {
                  authority: `${config.KEYCLOAK_CONFIG.authority}/realms/${config.KEYCLOAK_CONFIG.realm}/`,
                  client_id: config.KEYCLOAK_CONFIG.clientId,
                  resource: config.KEYCLOAK_CONFIG.clientId,
                  // Automatically renew the access token before it expires
                  automaticSilentRenew: true,
                  // Default sign in redirect
                  redirect_uri: buildUrl(window.location.origin),
                  // Default sign out redirect
                  post_logout_redirect_uri: logoutRedirectUri,
                  // Automatically load additional user profile information
                  loadUserInfo: true,
                  userStore: new WebStorageStateStore({ store: window.localStorage }),
                  onSigninCallback: (_): void => {
                    // See https://github.com/authts/react-oidc-context#getting-started
                    window.history.replaceState({}, document.title, window.location.pathname);
                  },
                };

                return (
                  <AuthProvider {...authConfig}>
                    <AuthContextProvider>
                      <AuthContext.Consumer>
                        {(authState) => {
                          if (!authState) {
                            return <CircularProgress className="pageProgress" size={40} />;
                          }

                          return <AppRouter />;
                        }}
                      </AuthContext.Consumer>
                    </AuthContextProvider>
                  </AuthProvider>
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
