import { CssBaseline } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { ThemeProvider } from '@mui/material/styles';
import { ConfigContext, ConfigContextProvider } from 'context/configContext';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from 'router/AppRouter';
import { appTheme } from 'theme/AppTheme';

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

                return <AppRouter />;
              }}
            </ConfigContext.Consumer>
          </ConfigContextProvider>
        </ThemeProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
