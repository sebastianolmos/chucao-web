import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@mantine/core/styles.css';
import '@fontsource/comfortaa/400.css';
import '@fontsource/comfortaa/700.css';

import { createTheme, MantineProvider } from '@mantine/core';

const theme = createTheme({
  fontFamily: '"Comfortaa", sans-serif',
  headings: {
    fontFamily: '"Comfortaa", sans-serif',
  },
});

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={theme}>
    <App />
  </MantineProvider>,
)
