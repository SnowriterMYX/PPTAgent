// API 相关类型定义
export interface UploadResponse {
  task_id: string;
}

export interface ProgressMessage {
  progress: number;
  status: string;
}

export interface FeedbackRequest {
  feedback: string;
  task_id: string;
}

export interface FeedbackResponse {
  message: string;
  filename: string;
}

// 应用状态类型
export interface AppState {
  // 当前任务
  currentTask: TaskInfo | null;
  setCurrentTask: (task: TaskInfo | null) => void;
  
  // 上传状态
  uploadProgress: number;
  setUploadProgress: (progress: number) => void;
  
  // 生成状态
  generationProgress: number;
  generationStatus: string;
  setGenerationProgress: (progress: number, status: string) => void;
  
  // 错误处理
  error: string | null;
  setError: (error: string | null) => void;
  
  // 清除状态
  clearState: () => void;
}

export interface TaskInfo {
  id: string;
  numberOfPages: number;
  pptxFile?: File;
  pdfFile?: File;  // 改为可选，因为现在支持多种文档类型
  createdAt: Date;
  status: TaskStatus;
  // 新增字段支持多种文档类型
  documentType?: 'pdf' | 'text' | 'input';
  textFile?: File;
  userInput?: string;
}

export enum TaskStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 文件上传相关
export interface FileUploadProps {
  accept: string;
  multiple?: boolean;
  maxSize?: number; // bytes
  onFileSelect: (files: File[]) => void;
  disabled?: boolean;
}

// 主题相关
export interface ThemeConfig {
  mode: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
  borderRadius: number;
  shadows: {
    neumorphism: string;
    neumorphismInset: string;
    elevation: string[];
  };
}

// 新拟物化样式配置
export interface NeumorphismConfig {
  background: string;
  shadowLight: string;
  shadowDark: string;
  borderRadius: number;
  padding: number;
}

// 响应式断点
export interface Breakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

// 动画配置
export interface AnimationConfig {
  duration: {
    short: number;
    medium: number;
    long: number;
  };
  easing: {
    easeInOut: string;
    easeOut: string;
    easeIn: string;
  };
}

// 组件通用属性
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  sx?: any; // MUI sx prop
}

// 页面路由类型
export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  title: string;
  description?: string;
}

// WebSocket 连接状态
export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

// 通知类型
export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
