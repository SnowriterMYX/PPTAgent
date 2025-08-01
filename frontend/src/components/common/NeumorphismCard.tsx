import React from 'react';
import { Card, CardProps, useTheme } from '@mui/material';
import { motion, MotionProps } from 'framer-motion';
import { getNeumorphismStyle } from '@/theme';

interface NeumorphismCardProps extends Omit<CardProps, 'component'> {
  // 是否显示按压效果
  pressed?: boolean;
  // 是否可交互（悬停效果）
  interactive?: boolean;
  // 动画配置
  animate?: boolean;
  // 自定义动画属性
  motionProps?: MotionProps;
  // 阴影强度 (1-3)
  shadowIntensity?: 1 | 2 | 3;
}

const NeumorphismCard = React.forwardRef<HTMLDivElement, NeumorphismCardProps>(({
  children,
  pressed = false,
  interactive = false,
  animate = true,
  motionProps,
  shadowIntensity = 1,
  sx,
  ...cardProps
}, ref) => {
  const theme = useTheme();
  const mode = theme.palette.mode;

  // 获取新拟物化样式
  const neumorphismStyle = getNeumorphismStyle(mode, pressed);

  // 根据强度调整阴影
  const adjustShadowIntensity = (boxShadow: string) => {
    if (shadowIntensity === 1) return boxShadow;
    
    // 简单的阴影强度调整逻辑
    const multiplier = shadowIntensity === 2 ? 1.5 : 2;
    return boxShadow.replace(/(\d+)px/g, (match, num) => {
      return `${Math.round(parseInt(num) * multiplier)}px`;
    });
  };

  // 合并样式
  const cardStyle = {
    ...neumorphismStyle,
    boxShadow: adjustShadowIntensity(neumorphismStyle.boxShadow),
    backgroundColor: theme.palette.background.paper,
    border: 'none',
    transition: interactive 
      ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
      : 'none',
    cursor: interactive ? 'pointer' : 'default',
    ...(interactive && {
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: mode === 'light'
          ? '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff'
          : '6px 6px 12px #1a202c, -6px -6px 12px #3a4553',
      },
      '&:active': {
        transform: 'translateY(0)',
        boxShadow: `inset 4px 4px 8px ${mode === 'light' ? '#d1d9e6' : '#1a202c'}, inset -4px -4px 8px ${mode === 'light' ? '#ffffff' : '#3a4553'}`,
      },
    }),
    ...sx,
  };

  // 默认动画配置
  const defaultMotionProps: MotionProps = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
    ...motionProps,
  };

  if (animate) {
    return (
      <motion.div {...defaultMotionProps} ref={ref}>
        <Card sx={cardStyle} {...cardProps}>
          {children}
        </Card>
      </motion.div>
    );
  }

  return (
    <Card sx={cardStyle} {...cardProps} ref={ref}>
      {children}
    </Card>
  );
});

NeumorphismCard.displayName = 'NeumorphismCard';

export default NeumorphismCard;
