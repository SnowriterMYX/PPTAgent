import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from '@/theme';
import { useThemeStore } from '@/store/appStore';
import AppLayout from '@/components/layout/AppLayout';
import NotificationProvider from '@/components/common/NotificationProvider';
import HomePage from '@/pages/HomePage';
import GeneratePage from '@/pages/GeneratePage';

const App: React.FC = () => {
  const { mode } = useThemeStore();
  const theme = createAppTheme(mode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/generate" element={<GeneratePage />} />
          </Routes>
        </AppLayout>
        <NotificationProvider />
      </Router>
    </ThemeProvider>
  );
};

export default App;
