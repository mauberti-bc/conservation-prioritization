import Box from '@mui/material/Box';
import { PropsWithChildren } from 'react';
import { Footer } from './footer/Footer';
import { Header } from './header/Header';

export const BaseLayout = (props: PropsWithChildren) => {
  return (
    <Box display="flex" flexDirection="column" height="100vh" overflow="hidden">
      <Header />
      <Box flex="1 1 auto" overflow="hidden">
        {props.children}
      </Box>
      <Footer />
    </Box>
  );
};
