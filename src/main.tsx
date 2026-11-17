import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './app/LocaleProvider';
import '@mantine/core/styles.css';
import '@fontsource/comfortaa/400.css';
import '@fontsource/comfortaa/700.css';

import { createTheme, MantineProvider } from '@mantine/core';
import { queryClient } from './lib/queryClient';

const theme = createTheme({
  fontFamily: '"Comfortaa", sans-serif',
  headings: {
    fontFamily: '"Comfortaa", sans-serif',
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
)
