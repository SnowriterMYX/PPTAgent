import { createTheme, ThemeOptions } from '@mui/material/styles';
import { zhCN } from '@mui/material/locale';

// 新拟物化设计配置
const neumorphismConfig = {
  light: {
    background: '#f0f2f5',
    shadowLight: '#ffffff',
    shadowDark: '#d1d9e6',
    borderRadius: 20,
  },
  dark: {
    background: '#2d3748',
    shadowLight: '#3a4553',
    shadowDark: '#1a202c',
    borderRadius: 20,
  },
};

// 自定义颜色调色板
const palette = {
  light: {
    primary: {
      main: '#667eea',
      light: '#8fa4f3',
      dark: '#4c63d2',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#764ba2',
      light: '#9575cd',
      dark: '#512da8',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f0f2f5',
      paper: '#ffffff',
      neumorphism: '#f0f2f5',
    },
    text: {
      primary: '#2d3748',
      secondary: '#4a5568',
    },
    divider: '#e2e8f0',
    success: {
      main: '#48bb78',
      light: '#68d391',
      dark: '#38a169',
    },
    warning: {
      main: '#ed8936',
      light: '#f6ad55',
      dark: '#dd6b20',
    },
    error: {
      main: '#f56565',
      light: '#fc8181',
      dark: '#e53e3e',
    },
    info: {
      main: '#4299e1',
      light: '#63b3ed',
      dark: '#3182ce',
    },
  },
  dark: {
    primary: {
      main: '#8fa4f3',
      light: '#b3c6f6',
      dark: '#667eea',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9575cd',
      light: '#b39ddb',
      dark: '#764ba2',
      contrastText: '#ffffff',
    },
    background: {
      default: '#1a202c',
      paper: '#2d3748',
      neumorphism: '#2d3748',
    },
    text: {
      primary: '#f7fafc',
      secondary: '#e2e8f0',
    },
    divider: '#4a5568',
    success: {
      main: '#68d391',
      light: '#9ae6b4',
      dark: '#48bb78',
    },
    warning: {
      main: '#f6ad55',
      light: '#fbb040',
      dark: '#ed8936',
    },
    error: {
      main: '#fc8181',
      light: '#feb2b2',
      dark: '#f56565',
    },
    info: {
      main: '#63b3ed',
      light: '#90cdf4',
      dark: '#4299e1',
    },
  },
};

// 创建主题函数
export const createAppTheme = (mode: 'light' | 'dark') => {
  const currentPalette = palette[mode];
  const currentNeumorphism = neumorphismConfig[mode];

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      ...currentPalette,
    },
    typography: {
      fontFamily: [
        'Noto Sans SC',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'sans-serif',
      ].join(','),
      h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 12,
    },
    spacing: 8,
    components: {
      // 自定义组件样式
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: currentNeumorphism.borderRadius,
            padding: '12px 24px',
            fontSize: '1rem',
            fontWeight: 500,
            textTransform: 'none',
            boxShadow: mode === 'light' 
              ? `8px 8px 16px ${currentNeumorphism.shadowDark}, -8px -8px 16px ${currentNeumorphism.shadowLight}`
              : `4px 4px 8px ${currentNeumorphism.shadowDark}, -4px -4px 8px ${currentNeumorphism.shadowLight}`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: mode === 'light'
                ? `12px 12px 24px ${currentNeumorphism.shadowDark}, -12px -12px 24px ${currentNeumorphism.shadowLight}`
                : `6px 6px 12px ${currentNeumorphism.shadowDark}, -6px -6px 12px ${currentNeumorphism.shadowLight}`,
            },
            '&:active': {
              transform: 'translateY(0)',
              boxShadow: `inset 4px 4px 8px ${currentNeumorphism.shadowDark}, inset -4px -4px 8px ${currentNeumorphism.shadowLight}`,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: currentNeumorphism.borderRadius,
            boxShadow: mode === 'light'
              ? `8px 8px 16px ${currentNeumorphism.shadowDark}, -8px -8px 16px ${currentNeumorphism.shadowLight}`
              : `4px 4px 8px ${currentNeumorphism.shadowDark}, -4px -4px 8px ${currentNeumorphism.shadowLight}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: currentNeumorphism.borderRadius,
            boxShadow: mode === 'light'
              ? `8px 8px 16px ${currentNeumorphism.shadowDark}, -8px -8px 16px ${currentNeumorphism.shadowLight}`
              : `4px 4px 8px ${currentNeumorphism.shadowDark}, -4px -4px 8px ${currentNeumorphism.shadowLight}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: currentNeumorphism.borderRadius,
              backgroundColor: currentNeumorphism.background,
              boxShadow: `inset 4px 4px 8px ${currentNeumorphism.shadowDark}, inset -4px -4px 8px ${currentNeumorphism.shadowLight}`,
              '& fieldset': {
                border: 'none',
              },
              '&:hover fieldset': {
                border: 'none',
              },
              '&.Mui-focused fieldset': {
                border: `2px solid ${currentPalette.primary.main}`,
              },
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            height: 8,
            backgroundColor: mode === 'light' ? '#e2e8f0' : '#4a5568',
          },
          bar: {
            borderRadius: 10,
          },
        },
      },
    },
  };

  return createTheme(themeOptions, zhCN);
};

// 导出新拟物化样式工具函数
export const getNeumorphismStyle = (mode: 'light' | 'dark', pressed = false) => {
  const config = neumorphismConfig[mode];
  
  if (pressed) {
    return {
      boxShadow: `inset 4px 4px 8px ${config.shadowDark}, inset -4px -4px 8px ${config.shadowLight}`,
    };
  }
  
  return {
    boxShadow: mode === 'light'
      ? `8px 8px 16px ${config.shadowDark}, -8px -8px 16px ${config.shadowLight}`
      : `4px 4px 8px ${config.shadowDark}, -4px -4px 8px ${config.shadowLight}`,
  };
};

// 导出动画配置
export const animations = {
  duration: {
    short: 200,
    medium: 300,
    long: 500,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
};

// 导出响应式断点
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};
