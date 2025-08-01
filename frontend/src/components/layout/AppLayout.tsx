import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useThemeStore } from '@/store/appStore';
import { getNeumorphismStyle } from '@/theme';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const { mode, toggleMode } = useThemeStore();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
      }}
    >
      {/* 顶部导航栏 */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          ...getNeumorphismStyle(mode),
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'flex-end', py: 1 }}>
            {/* 右侧操作 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* GitHub链接 */}
                <IconButton
                  href="https://github.com/icip-cas/PPTAgent"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    ...getNeumorphismStyle(mode),
                    color: theme.palette.text.primary,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <GitHubIcon />
                </IconButton>

                {/* 主题切换 */}
                <IconButton
                  onClick={toggleMode}
                  sx={{
                    ...getNeumorphismStyle(mode),
                    color: theme.palette.text.primary,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Box>
            </motion.div>
          </Toolbar>
        </Container>
      </AppBar>

      {/* 主要内容区域 */}
      <Box component="main" sx={{ flexGrow: 1, pb: 4 }}>
        {children}
      </Box>
    </Box>
  );
};

export default AppLayout;
