import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketStore, useAppStore, useNotificationStore } from '@/store/appStore';
import { WebSocketManager } from '@/utils/api';
import { ProgressMessage } from '@/types';

interface UseWebSocketOptions {
  taskId: string;
  onProgress?: (progress: number, status: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export const useWebSocket = ({
  taskId,
  onProgress,
  onComplete,
  onError,
  autoConnect = true,
}: UseWebSocketOptions) => {
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const { setStatus, setLastMessage } = useWebSocketStore();
  const { setGenerationProgress, setError } = useAppStore();
  const { addNotification } = useNotificationStore();

  // 处理WebSocket消息
  const handleMessage = useCallback((data: ProgressMessage) => {
    console.log('WebSocket message received:', data);
    setLastMessage(data);

    // 更新进度状态
    setGenerationProgress(data.progress, data.status);

    // 调用外部回调
    onProgress?.(data.progress, data.status);

    // 检查是否完成
    if (data.progress >= 100) {
      setStatus('disconnected');
      onComplete?.();

      addNotification({
        type: 'success',
        title: 'PPT生成完成',
        message: '您的演示文稿已成功生成，可以下载了！',
        duration: 5000,
      });
    }
  }, [onProgress, onComplete]); // 只保留外部回调依赖

  // 处理WebSocket错误
  const handleError = useCallback((error: Event) => {
    console.error('WebSocket error:', error);
    setStatus('error');

    const errorMessage = '连接服务器失败，请检查网络连接';
    setError(errorMessage);
    onError?.(errorMessage);

    addNotification({
      type: 'error',
      title: '连接错误',
      message: errorMessage,
      duration: 5000,
    });
  }, [onError]); // 移除Zustand setters，它们是稳定的

  // 处理WebSocket关闭
  const handleClose = useCallback(() => {
    console.log('WebSocket connection closed');
    setStatus('disconnected');
  }, []); // 移除setStatus依赖

  // 连接WebSocket
  const connect = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
    }

    setStatus('connecting');

    wsManagerRef.current = new WebSocketManager(
      taskId,
      handleMessage,
      handleError,
      handleClose
    );

    wsManagerRef.current.connect();

    // 设置连接超时
    setTimeout(() => {
      if (wsManagerRef.current && !wsManagerRef.current.isConnected()) {
        handleError(new Event('Connection timeout'));
      } else {
        setStatus('connected');
      }
    }, 5000);
  }, [taskId, handleMessage, handleError, handleClose]); // 移除setStatus依赖

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      wsManagerRef.current = null;
    }
    setStatus('disconnected');
  }, []); // 移除setStatus依赖

  // 重新连接
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // 检查连接状态
  const isConnected = useCallback(() => {
    return wsManagerRef.current?.isConnected() || false;
  }, []);

  // 自动连接
  useEffect(() => {
    if (autoConnect && taskId && taskId.trim() !== '') {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, taskId, connect, disconnect]);

  // 页面卸载时断开连接
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    reconnect,
    isConnected,
  };
};

// 简化版本的WebSocket Hook，用于快速集成
export const useSimpleWebSocket = (taskId: string) => {
  const { setGenerationProgress } = useAppStore();
  const { addNotification } = useNotificationStore();

  return useWebSocket({
    taskId,
    onProgress: (progress, status) => {
      setGenerationProgress(progress, status);
    },
    onComplete: () => {
      addNotification({
        type: 'success',
        title: '生成完成',
        message: 'PPT已成功生成！',
      });
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: '连接错误',
        message: error,
      });
    },
  });
};
