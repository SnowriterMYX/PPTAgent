import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  LinearProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  useTheme,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Feedback as FeedbackIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NeumorphismCard from '@/components/common/NeumorphismCard';
import { useAppStore, useNotificationStore } from '@/store/appStore';
import { apiService } from '@/utils/api';
import { TaskStatus } from '@/types';

const GeneratePage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const { currentTask, clearState } = useAppStore();
  const { addNotification } = useNotificationStore();

  // 本地状态 - 简化版本，类似Vue实现
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting...');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket引用 - 简化版本
  const wsRef = useRef<WebSocket | null>(null);
  const taskId = currentTask?.id;

  // 简化的WebSocket连接函数
  const startGeneration = async () => {
    if (!taskId) {
      navigate('/');
      return;
    }

    console.log("Connecting to websocket", `/wsapi/${taskId}`);

    // 创建WebSocket连接 - 构建正确的WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/wsapi/${taskId}`;

    console.log("WebSocket URL:", wsUrl);
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      console.log("Socket Received message:", event.data);
      try {
        const data = JSON.parse(event.data);
        setProgress(data.progress);
        setStatusMessage(data.status);

        if (data.progress >= 100) {
          closeSocket();
          fetchDownloadLink();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatusMessage('WebSocket connection failed.');
      setError('连接服务器失败，请检查网络连接');
      closeSocket();
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
    };
  };

  // 关闭WebSocket连接
  const closeSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // 检查任务状态并启动连接
  useEffect(() => {
    if (!currentTask) {
      navigate('/');
      return;
    }

    // 启动WebSocket连接
    startGeneration();

    // 清理函数
    return () => {
      closeSocket();
    };
  }, [currentTask, navigate]);

  // 获取下载链接
  const fetchDownloadLink = async () => {
    if (!taskId || downloadUrl) return;

    try {
      const blob = await apiService.downloadPPT(taskId);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      addNotification({
        type: 'success',
        title: '生成完成',
        message: 'PPT已成功生成，可以下载了！',
      });
    } catch (error) {
      console.error("Download error:", error);
      setStatusMessage(prev => prev + '\nFailed to continue the task.');
      setError('下载准备失败');
    }
  };

  // 下载文件
  const handleDownload = async () => {
    if (!downloadUrl || !taskId) return;

    setIsDownloading(true);
    try {
      const filename = `PPTAgent_${taskId.replace(/[/|]/g, '_')}.pptx`;

      // 创建下载链接
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addNotification({
        type: 'success',
        title: '下载成功',
        message: 'PPT文件已保存到您的设备',
      });
    } catch (error) {
      console.error('Download failed:', error);
      addNotification({
        type: 'error',
        title: '下载失败',
        message: '文件下载失败，请重试',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // 提交反馈
  const handleSubmitFeedback = async () => {
    if (!feedback.trim() || !taskId) return;

    setIsSubmittingFeedback(true);
    try {
      await apiService.submitFeedback({
        feedback: feedback.trim(),
        task_id: taskId,
      });

      addNotification({
        type: 'success',
        title: '反馈提交成功',
        message: '感谢您的宝贵意见！',
      });

      setFeedback('');
      setFeedbackOpen(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      addNotification({
        type: 'error',
        title: '反馈提交失败',
        message: error instanceof Error ? error.message : '提交失败，请重试',
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // 重新开始
  const handleRestart = () => {
    clearState();
    navigate('/');
  };

  // 重试连接
  const handleRetry = () => {
    setError(null);
    startGeneration();
  };

  // 获取状态信息
  const getStatusInfo = () => {
    if (error) {
      return {
        color: 'error' as const,
        icon: <ErrorIcon />,
        title: '生成失败',
        description: error,
      };
    }

    if (progress >= 100 || downloadUrl) {
      return {
        color: 'success' as const,
        icon: <CheckCircleIcon />,
        title: '生成完成',
        description: '您的PPT已成功生成！',
      };
    }

    return {
      color: 'primary' as const,
      icon: null,
      title: '正在生成中...',
      description: statusMessage,
    };
  };

  const statusInfo = getStatusInfo();
  const isCompleted = progress >= 100 || downloadUrl;
  const hasError = !!error;

  if (!currentTask) {
    return null;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* 页面标题 */}
        <Box textAlign="center" mb={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            PPT生成进度
          </Typography>
          <Typography variant="body1" color="text.secondary">
            任务ID: {currentTask.id}
          </Typography>
        </Box>

        {/* 任务信息 */}
        <NeumorphismCard sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            任务信息
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                PDF文档：
              </Typography>
              <Typography variant="body1">
                {currentTask.pdfFile.name}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                PPT模板：
              </Typography>
              <Typography variant="body1">
                {currentTask.pptxFile?.name || '默认模板'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                生成页数：
              </Typography>
              <Typography variant="body1">
                {currentTask.numberOfPages} 页
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                创建时间：
              </Typography>
              <Typography variant="body1">
                {currentTask.createdAt.toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </NeumorphismCard>

        {/* 状态卡片 */}
        <NeumorphismCard sx={{ p: 4, mb: 4, textAlign: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={statusInfo.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              {statusInfo.icon && (
                <Box sx={{ mb: 2, color: theme.palette[statusInfo.color].main }}>
                  {React.cloneElement(statusInfo.icon, { sx: { fontSize: 64 } })}
                </Box>
              )}
              
              <Typography variant="h5" gutterBottom color={statusInfo.color}>
                {statusInfo.title}
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {statusInfo.description}
              </Typography>

              {/* 进度条 */}
              {!hasError && !isCompleted && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      进度
                    </Typography>
                    <Typography variant="body2">
                      {progress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>
              )}

              {/* 连接状态 */}
              <Box sx={{ mb: 3 }}>
                <Chip
                  label={wsRef.current?.readyState === WebSocket.OPEN ? '已连接' : '连接中断'}
                  color={wsRef.current?.readyState === WebSocket.OPEN ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
            </motion.div>
          </AnimatePresence>
        </NeumorphismCard>

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* 下载按钮 */}
          <AnimatePresence>
            {isCompleted && downloadUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  disabled={isDownloading}
                  sx={{ minWidth: 140 }}
                >
                  {isDownloading ? '下载中...' : '下载PPT'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 反馈按钮 */}
          <Button
            variant="outlined"
            size="large"
            startIcon={<FeedbackIcon />}
            onClick={() => setFeedbackOpen(true)}
            sx={{ minWidth: 140 }}
          >
            提交反馈
          </Button>

          {/* 重试按钮 */}
          {hasError && (
            <Button
              variant="outlined"
              size="large"
              startIcon={<RefreshIcon />}
              onClick={handleRetry}
              color="error"
              sx={{ minWidth: 140 }}
            >
              重试连接
            </Button>
          )}

          {/* 重新开始按钮 */}
          <Button
            variant="text"
            size="large"
            startIcon={<HomeIcon />}
            onClick={handleRestart}
            sx={{ minWidth: 140 }}
          >
            重新开始
          </Button>
        </Box>

        {/* 错误提示 */}
        <AnimatePresence>
          {hasError && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Alert severity="error" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  {error}
                </Typography>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 反馈对话框 */}
      <Dialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>提交反馈</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="请分享您的使用体验、建议或遇到的问题..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmitFeedback}
            disabled={!feedback.trim() || isSubmittingFeedback}
            variant="contained"
          >
            {isSubmittingFeedback ? '提交中...' : '提交'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GeneratePage;
