import React from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  Portal,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotificationStore } from '@/store/appStore';

const NotificationProvider: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          top: 80,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxWidth: 400,
        }}
      >
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 300, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.9 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
            >
              <Alert
                severity={notification.type}
                onClose={() => removeNotification(notification.id)}
                sx={{
                  width: '100%',
                  boxShadow: 3,
                  backdropFilter: 'blur(10px)',
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
                action={
                  notification.action && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={notification.action.onClick}
                    >
                      {notification.action.label}
                    </Button>
                  )
                }
              >
                <AlertTitle>{notification.title}</AlertTitle>
                {notification.message}
              </Alert>
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>
    </Portal>
  );
};

export default NotificationProvider;
