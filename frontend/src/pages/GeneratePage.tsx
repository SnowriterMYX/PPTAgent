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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Feedback as FeedbackIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NeumorphismCard from '@/components/common/NeumorphismCard';
import { useAppStore, useNotificationStore } from '@/store/appStore';
import { apiService } from '@/utils/api';
import { TaskStatus } from '@/types';

// 时间格式化工具函数
const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.round((ms % 3600000) / 60000);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
};

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

  // LLM记录相关状态
  const [llmLogs, setLlmLogs] = useState<any[]>([]);
  const [llmLogsOpen, setLlmLogsOpen] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [llmSummary, setLlmSummary] = useState<any>(null);

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

  // 获取LLM记录
  const fetchLlmLogs = async () => {
    if (!taskId || isLoadingLogs) return;

    setIsLoadingLogs(true);
    try {
      const response = await fetch(`/api/llm-logs/${taskId}`);
      if (response.ok) {
        const data = await response.json();
        setLlmLogs(data.logs || []);
      } else {
        console.error('Failed to fetch LLM logs:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching LLM logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // 获取LLM记录摘要
  const fetchLlmSummary = async () => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/llm-logs/${taskId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setLlmSummary(data.summary);
      } else {
        console.error('Failed to fetch LLM summary:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching LLM summary:', error);
    }
  };

  // 打开LLM记录对话框
  const handleOpenLlmLogs = () => {
    setLlmLogsOpen(true);
    fetchLlmLogs();
    fetchLlmSummary();
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

              {/* 连接状态 - 只在生成过程中显示 */}
              {!hasError && !isCompleted && (
                <Box sx={{ mb: 3 }}>
                  <Chip
                    label={wsRef.current?.readyState === WebSocket.OPEN ? '已连接' : '连接中断'}
                    color={wsRef.current?.readyState === WebSocket.OPEN ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
              )}
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

          {/* LLM记录按钮 */}
          <Button
            variant="outlined"
            size="large"
            startIcon={<PsychologyIcon />}
            onClick={handleOpenLlmLogs}
            sx={{ minWidth: 140 }}
          >
            LLM记录
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

      {/* LLM记录对话框 */}
      <Dialog
        open={llmLogsOpen}
        onClose={() => setLlmLogsOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <PsychologyIcon />
          LLM请求记录
          {llmSummary && (
            <>
              <Chip
                label={`${llmSummary.total_requests} 个请求`}
                size="small"
                color="primary"
              />
              {llmSummary.total_tokens > 0 && (
                <Chip
                  label={`${llmSummary.total_tokens.toLocaleString()} Tokens`}
                  size="small"
                  color="secondary"
                />
              )}
            </>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {isLoadingLogs ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>正在加载LLM记录...</Typography>
            </Box>
          ) : (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              {/* 摘要信息 */}
              {llmSummary && (
                <Card sx={{ m: 2, mb: 1 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TimelineIcon />
                      统计摘要
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">总请求数</Typography>
                        <Typography variant="h6">{llmSummary.total_requests}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">成功请求</Typography>
                        <Typography variant="h6" color="success.main">{llmSummary.successful_requests}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">失败请求</Typography>
                        <Typography variant="h6" color="error.main">{llmSummary.failed_requests}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">总耗时</Typography>
                        <Typography variant="h6">{formatDuration(llmSummary.total_duration_ms)}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">总Token数</Typography>
                        <Typography variant="h6" color="primary.main">
                          {llmSummary.total_tokens ? llmSummary.total_tokens.toLocaleString() : '0'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">平均耗时</Typography>
                        <Typography variant="h6">
                          {llmSummary.total_requests > 0
                            ? formatDuration(llmSummary.total_duration_ms / llmSummary.total_requests)
                            : '0ms'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* 阶段统计 */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>各阶段请求数</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {Object.entries(llmSummary.stages).map(([stage, count]) => (
                          <Chip
                            key={stage}
                            label={`${stage}: ${count}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* 模型类型统计 */}
                    {llmSummary.model_types && Object.keys(llmSummary.model_types).length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>模型类型分布</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {Object.entries(llmSummary.model_types).map(([modelType, count]) => (
                            <Chip
                              key={modelType}
                              label={`${modelType}: ${count}`}
                              size="small"
                              variant="outlined"
                              color="secondary"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Token使用效率 */}
                    {llmSummary.total_tokens > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>Token使用效率</Typography>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">平均每请求Token</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {Math.round(llmSummary.total_tokens / llmSummary.total_requests)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Token/秒</Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {llmSummary.total_duration_ms > 0
                                ? Math.round(llmSummary.total_tokens / (llmSummary.total_duration_ms / 1000))
                                : 0}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 详细记录 */}
              <Box sx={{ p: 2, pt: 1 }}>
                {llmLogs.length === 0 ? (
                  <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    暂无LLM请求记录
                  </Typography>
                ) : (
                  llmLogs.map((log, index) => (
                    <Accordion key={log.request_id || index} sx={{ mb: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          <Chip
                            label={log.status}
                            size="small"
                            color={log.status === 'success' ? 'success' : 'error'}
                          />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {log.stage} - {log.agent_role || '未知角色'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {log.model_type} | {formatDuration(log.duration_ms)}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>请求内容</Typography>
                            <Box sx={{
                              bgcolor: 'grey.50',
                              p: 2,
                              borderRadius: 1,
                              maxHeight: 200,
                              overflow: 'auto',
                              fontSize: '0.875rem',
                              fontFamily: 'monospace'
                            }}>
                              {log.request?.content || '无内容'}
                            </Box>
                            {log.request?.images && log.request.images.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  图像: {log.request.images.length} 个
                                </Typography>
                              </Box>
                            )}
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>响应内容</Typography>
                            <Box sx={{
                              bgcolor: 'grey.50',
                              p: 2,
                              borderRadius: 1,
                              maxHeight: 200,
                              overflow: 'auto',
                              fontSize: '0.875rem',
                              fontFamily: 'monospace'
                            }}>
                              {log.response?.content || log.response?.error || '无内容'}
                            </Box>
                            {log.response?.tokens_used && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Token使用: {log.response.tokens_used.toLocaleString()}
                                </Typography>
                                {log.duration_ms > 0 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                    速率: {Math.round(log.response.tokens_used / (log.duration_ms / 1000))} tokens/s
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Grid>
                        </Grid>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            时间: {new Date(log.timestamp).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            模型: {log.model_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            请求ID: {log.request_id}
                          </Typography>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLlmLogsOpen(false)}>
            关闭
          </Button>
          <Button onClick={fetchLlmLogs} disabled={isLoadingLogs}>
            刷新
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GeneratePage;
