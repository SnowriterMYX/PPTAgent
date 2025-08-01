import React, { useState, useCallback } from 'react';
import {
  Container,
  Grid,
  Typography,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  Upload as UploadIcon,
  AutoAwesome as AutoAwesomeIcon,
  Download as DownloadIcon,
  Feedback as FeedbackIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NeumorphismCard from '@/components/common/NeumorphismCard';
import FileUpload from '@/components/common/FileUpload';
import { useAppStore, useNotificationStore } from '@/store/appStore';
import { apiService } from '@/utils/api';
import { TaskInfo, TaskStatus } from '@/types';

const steps = ['上传文件', '配置参数', '开始生成'];

const HomePage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { setCurrentTask, setUploadProgress, setError } = useAppStore();
  const { addNotification } = useNotificationStore();

  // 表单状态
  const [activeStep, setActiveStep] = useState(0);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pptxFiles, setPptxFiles] = useState<File[]>([]);
  const [numberOfPages, setNumberOfPages] = useState(6);
  const [topic, setTopic] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressValue, setUploadProgressValue] = useState(0);

  // 验证当前步骤
  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 0: // 文件上传
        return pdfFiles.length > 0;
      case 1: // 参数配置
        return numberOfPages >= 3 && numberOfPages <= 15;
      case 2: // 确认
        return true;
      default:
        return false;
    }
  }, [pdfFiles.length, numberOfPages]);

  // 下一步
  const handleNext = useCallback(() => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  }, [activeStep, validateStep]);

  // 上一步
  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  // 开始生成
  const handleStartGeneration = useCallback(async () => {
    if (!pdfFiles[0]) {
      addNotification({
        type: 'error',
        title: '文件缺失',
        message: '请先上传PDF文件',
      });
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 检查后端连接
      await apiService.healthCheck();

      // 上传文件
      const response = await apiService.uploadFiles(
        pdfFiles[0],
        pptxFiles[0],
        numberOfPages,
        topic || undefined,
        (progress) => {
          setUploadProgressValue(progress);
          setUploadProgress(progress);
        }
      );

      // 创建任务信息
      const taskInfo: TaskInfo = {
        id: response.task_id,
        numberOfPages,
        pdfFile: pdfFiles[0],
        pptxFile: pptxFiles[0],
        createdAt: new Date(),
        status: TaskStatus.PROCESSING,
      };

      setCurrentTask(taskInfo);

      addNotification({
        type: 'success',
        title: '上传成功',
        message: '文件已成功上传，正在开始生成PPT...',
      });

      // 跳转到生成页面
      navigate('/generate');

    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : '上传失败，请重试';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: '上传失败',
        message: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  }, [
    pdfFiles,
    pptxFiles,
    numberOfPages,
    topic,
    setCurrentTask,
    setUploadProgress,
    setError,
    addNotification,
    navigate,
  ]);

  // 渲染步骤内容
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ maxWidth: 700, mx: 'auto' }}>
            <Grid container spacing={4}>
              <Grid item xs={12}>
                <FileUpload
                  title="📄 上传PDF文档"
                  description="选择您要转换为PPT的PDF文档"
                  accept={['.pdf', 'application/pdf']}
                  maxSize={50}
                  files={pdfFiles}
                  onFilesChange={setPdfFiles}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FileUpload
                  title="🎨 上传PPT模板（可选）"
                  description="上传参考模板，系统将学习其设计风格"
                  accept={['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']}
                  maxSize={30}
                  files={pptxFiles}
                  onFilesChange={setPptxFiles}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            <Grid container spacing={4}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>生成页数</InputLabel>
                  <Select
                    value={numberOfPages}
                    label="生成页数"
                    onChange={(e) => setNumberOfPages(Number(e.target.value))}
                    sx={{ borderRadius: 2 }}
                  >
                    {Array.from({ length: 13 }, (_, i) => i + 3).map(num => (
                      <MenuItem key={num} value={num}>
                        {num} 页
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="主题描述（可选）"
                  placeholder="例如：产品介绍、学术报告等"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.info.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <Typography variant="body2">
                    💡 页数建议6-12页，主题描述有助于AI更好理解内容
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
              确认生成配置
            </Typography>

            <Box sx={{
              p: 3,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.primary.main, 0.03),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              mb: 3
            }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    📄 PDF文档
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {pdfFiles[0]?.name || '未选择'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    📊 生成页数
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {numberOfPages} 页
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    🎨 PPT模板
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {pptxFiles[0]?.name ? '已上传' : '默认模板'}
                  </Typography>
                </Grid>
                {topic && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      🎯 主题描述
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {topic}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>

            <Alert
              severity="info"
              sx={{
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.warning.main, 0.05),
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
              }}
            >
              <Typography variant="body2">
                ⏱️ 生成过程需要3-10分钟，请耐心等待
              </Typography>
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* 生成向导 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <NeumorphismCard sx={{ p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto' }}>
          {/* 步骤指示器 */}
          <Stepper
            activeStep={activeStep}
            sx={{
              mb: 5,
              '& .MuiStepLabel-label': {
                fontSize: '1rem',
                fontWeight: 500
              },
              '& .MuiStepIcon-root': {
                fontSize: '1.5rem'
              }
            }}
            orientation={isMobile ? 'vertical' : 'horizontal'}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* 步骤内容 */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent(activeStep)}
            </motion.div>
          </AnimatePresence>

          {/* 操作按钮 */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 5 }}>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                variant="outlined"
                size="large"
                sx={{
                  px: 4,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 500
                }}
              >
                上一步
              </Button>
            )}

            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleStartGeneration}
                disabled={!validateStep(activeStep) || isUploading}
                size="large"
                startIcon={<AutoAwesomeIcon />}
                sx={{
                  px: 6,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                  },
                }}
              >
                {isUploading ? '上传中...' : '开始生成PPT'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!validateStep(activeStep)}
                size="large"
                sx={{
                  px: 5,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1rem',
                  fontWeight: 500,
                  textTransform: 'none'
                }}
              >
                下一步
              </Button>
            )}
          </Box>

          {/* 上传进度 */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    上传进度：{uploadProgressValue}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgressValue}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </NeumorphismCard>
      </motion.div>
    </Container>
  );
};

export default HomePage;
