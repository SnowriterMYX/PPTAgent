import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { UploadResponse, FeedbackRequest, FeedbackResponse } from '@/types';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 120000, // 增加到2分钟，用于文件上传
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('Response Error:', error);
    
    // 统一错误处理
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      switch (status) {
        case 400:
          throw new Error(data.detail || '请求参数错误');
        case 404:
          throw new Error(data.detail || '请求的资源不存在');
        case 500:
          throw new Error(data.detail || '服务器内部错误');
        default:
          throw new Error(data.detail || `请求失败 (${status})`);
      }
    } else if (error.request) {
      // 网络错误
      throw new Error('网络连接失败，请检查网络设置');
    } else {
      // 其他错误
      throw new Error(error.message || '未知错误');
    }
  }
);

// API 方法定义
export const apiService = {
  // 健康检查
  healthCheck: async (): Promise<{ message: string }> => {
    // 统一使用代理，避免直接连接问题
    const response = await api.get('/', { timeout: 5000 });
    return response.data;
  },

  // 文件上传
  uploadFiles: async (
    pdfFile?: File,
    pptxFile?: File,
    numberOfPages: number = 6,
    topic?: string,
    onUploadProgress?: (progress: number) => void,
    textFile?: File,
    userInput?: string
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('numberOfPages', numberOfPages.toString());

    // 添加PDF文件（如果有）
    if (pdfFile) {
      formData.append('pdfFile', pdfFile);
    }

    // 添加文本文件（如果有）
    if (textFile) {
      formData.append('textFile', textFile);
    }

    // 添加用户输入（如果有）
    if (userInput) {
      formData.append('userInput', userInput);
    }

    // 添加PPT模板文件（如果有）
    if (pptxFile) {
      formData.append('pptxFile', pptxFile);
    }

    // 添加主题（如果有）
    if (topic) {
      formData.append('topic', topic);
    }

    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5分钟超时，专门用于文件上传
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onUploadProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(progress);
        }
      },
    });

    return response.data;
  },

  // 下载生成的PPT
  downloadPPT: async (taskId: string): Promise<Blob> => {
    const response = await api.get('/download', {
      params: { task_id: taskId },
      responseType: 'blob',
    });
    return response.data;
  },

  // 提交反馈
  submitFeedback: async (feedback: FeedbackRequest): Promise<FeedbackResponse> => {
    const response = await api.post<FeedbackResponse>('/feedback', feedback);
    return response.data;
  },
};

// WebSocket 连接管理
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private taskId: string;
  private onMessage: (data: any) => void;
  private onError: (error: Event) => void;
  private onClose: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    taskId: string,
    onMessage: (data: any) => void,
    onError: (error: Event) => void,
    onClose: () => void
  ) {
    this.taskId = taskId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
  }

  connect(): void {
    try {
      // 在开发环境中直接连接到后端WebSocket
      const isDev = import.meta.env.DEV;
      // 对taskId进行URL编码，确保特殊字符正确传输
      const encodedTaskId = encodeURIComponent(this.taskId);
      const wsUrl = isDev
        ? `ws://localhost:9297/wsapi/${encodedTaskId}`
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/wsapi/${encodedTaskId}`;

      console.log('Connecting to WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        this.ws = null;
        this.onClose();

        // 只在非正常关闭时尝试重连
        if (event.code !== 1000 && event.code !== 1001) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.onError(error as Event);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect(): void {
    // 停止重连尝试
    this.reconnectAttempts = this.maxReconnectAttempts;

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect'); // 正常关闭
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 文件工具函数
export const fileUtils = {
  // 格式化文件大小
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // 验证文件类型
  validateFileType: (file: File, allowedTypes: string[]): boolean => {
    return allowedTypes.some(type => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      return file.type.includes(type);
    });
  },

  // 验证文件大小
  validateFileSize: (file: File, maxSizeInMB: number): boolean => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  },

  // 创建文件下载
  downloadFile: (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export default api;
