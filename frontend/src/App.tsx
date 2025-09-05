import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
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
          <AppRouter />;
        </ThemeProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
