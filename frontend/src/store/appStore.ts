import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AppState, TaskInfo, TaskStatus } from '@/types';

// 应用主状态管理
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // 当前任务
        currentTask: null,
        setCurrentTask: (task: TaskInfo | null) => 
          set({ currentTask: task }, false, 'setCurrentTask'),

        // 上传进度
        uploadProgress: 0,
        setUploadProgress: (progress: number) => 
          set({ uploadProgress: progress }, false, 'setUploadProgress'),

        // 生成进度
        generationProgress: 0,
        generationStatus: '准备中...',
        setGenerationProgress: (progress: number, status: string) => 
          set({ 
            generationProgress: progress, 
            generationStatus: status 
          }, false, 'setGenerationProgress'),

        // 错误处理
        error: null,
        setError: (error: string | null) => 
          set({ error }, false, 'setError'),

        // 清除状态
        clearState: () => 
          set({
            currentTask: null,
            uploadProgress: 0,
            generationProgress: 0,
            generationStatus: '准备中...',
            error: null,
          }, false, 'clearState'),
      }),
      {
        name: 'pptagent-storage',
        partialize: (state) => ({
          // 只持久化必要的状态
          currentTask: state.currentTask,
        }),
      }
    ),
    {
      name: 'PPTAgent Store',
    }
  )
);

// 主题状态管理
interface ThemeState {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  setMode: (mode: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set) => ({
        mode: 'light',
        toggleMode: () => 
          set((state) => ({ 
            mode: state.mode === 'light' ? 'dark' : 'light' 
          }), false, 'toggleMode'),
        setMode: (mode: 'light' | 'dark') => 
          set({ mode }, false, 'setMode'),
      }),
      {
        name: 'pptagent-theme',
      }
    ),
    {
      name: 'Theme Store',
    }
  )
);

// 通知状态管理
interface NotificationState {
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
    timestamp: number;
  }>;
  addNotification: (notification: Omit<NotificationState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      notifications: [],
      addNotification: (notification) => {
        const id = Date.now().toString();
        const timestamp = Date.now();
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id, timestamp }
          ]
        }), false, 'addNotification');
        
        // 自动移除通知
        if (notification.duration !== 0) {
          setTimeout(() => {
            set((state) => ({
              notifications: state.notifications.filter(n => n.id !== id)
            }), false, 'autoRemoveNotification');
          }, notification.duration || 5000);
        }
      },
      removeNotification: (id: string) => 
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }), false, 'removeNotification'),
      clearNotifications: () => 
        set({ notifications: [] }, false, 'clearNotifications'),
    }),
    {
      name: 'Notification Store',
    }
  )
);

// WebSocket 连接状态管理
interface WebSocketState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: any;
  setStatus: (status: WebSocketState['status']) => void;
  setLastMessage: (message: any) => void;
}

export const useWebSocketStore = create<WebSocketState>()(
  devtools(
    (set) => ({
      status: 'disconnected',
      lastMessage: null,
      setStatus: (status) => 
        set({ status }, false, 'setWebSocketStatus'),
      setLastMessage: (message) => 
        set({ lastMessage: message }, false, 'setLastMessage'),
    }),
    {
      name: 'WebSocket Store',
    }
  )
);
