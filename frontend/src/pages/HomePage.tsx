import React, { useState, useCallback } from 'react';
import {
  Container,
  Grid,
  Typography,
  Button,
  Box,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha,
  FormControlLabel,
  Checkbox,
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
import MultiFormatUpload from '@/components/common/MultiFormatUpload';
import { useAppStore, useNotificationStore } from '@/store/appStore';
import { apiService } from '@/utils/api';
import { TaskInfo, TaskStatus } from '@/types';

const steps = ['主题配置', '参考资料', '开始生成'];

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
  const [numberOfPages, setNumberOfPages] = useState(10);

  // 新增：多格式文档支持
  const [documentContent, setDocumentContent] = useState<{
    type: 'pdf' | 'text' | 'input';
    file?: File;
    text?: string;
  } | null>(null);

  // 新增：主题配置状态
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [presentationStyle, setPresentationStyle] = useState('');
  const [userContext, setUserContext] = useState('');
  const [generateTopicContent, setGenerateTopicContent] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressValue, setUploadProgressValue] = useState(0);

  // 处理文档内容变化
  const handleDocumentContentChange = useCallback((content: {
    type: 'pdf' | 'text' | 'input';
    file?: File;
    text?: string;
  }) => {
    setDocumentContent(content);
    // 兼容旧的PDF文件状态
    if (content.type === 'pdf' && content.file) {
      setPdfFiles([content.file]);
    } else {
      setPdfFiles([]);
    }
  }, []);

  // 验证当前步骤
  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 0: // 主题配置
        return topic.trim().length > 0 && numberOfPages >= 3 && numberOfPages <= 50;
      case 1: // 参考资料
        return true;
      case 2: // 确认
        return true;
      default:
        return false;
    }
  }, [topic, numberOfPages]);

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
    if (!topic.trim()) {
      addNotification({
        type: 'error',
        title: '主题缺失',
        message: '请先输入演示主题',
      });
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 检查后端连接
      await apiService.healthCheck();

      // 准备上传参数
      let pdfFile: File | undefined;
      let textFile: File | undefined;
      let userInputText: string | undefined;

      if (documentContent?.type === 'pdf' && documentContent.file) {
        pdfFile = documentContent.file;
      } else if (documentContent?.type === 'text' && documentContent.file) {
        textFile = documentContent.file;
      } else if (documentContent?.type === 'input' && documentContent.text) {
        userInputText = documentContent.text;
      }

      // 上传文件
      const response = await apiService.uploadFiles(
        pdfFile,
        pptxFiles[0],
        numberOfPages,
        topic,
        (progress) => {
          setUploadProgressValue(progress);
          setUploadProgress(progress);
        },
        textFile,
        userInputText,
        targetAudience,
        presentationStyle,
        userContext,
        generateTopicContent
      );

      // 创建任务信息
      const taskInfo: TaskInfo = {
        id: response.task_id,
        numberOfPages,
        pdfFile: documentContent?.type === 'pdf' ? documentContent.file : undefined,
        pptxFile: pptxFiles[0],
        createdAt: new Date(),
        status: TaskStatus.PROCESSING,
        // 新增字段记录文档类型和内容
        documentType: documentContent?.type,
        textFile: documentContent?.type === 'text' ? documentContent.file : undefined,
        userInput: documentContent?.type === 'input' ? documentContent.text : undefined,
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
            <NeumorphismCard>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                🎯 主题配置
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="演示主题"
                    placeholder="例如：人工智能在医疗领域的应用、公司产品介绍、项目进展汇报等"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    error={topic.length > 0 && topic.trim().length === 0}
                    helperText={topic.length > 0 && topic.trim().length === 0 ? "主题不能为空" : "请输入您要制作PPT的主题"}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="目标受众（可选）"
                    placeholder="例如：技术团队、管理层、客户等"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="演示风格（可选）"
                    placeholder="例如：正式商务、学术报告、创意展示等"
                    value={presentationStyle}
                    onChange={(e) => setPresentationStyle(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="生成页数"
                    placeholder="请输入页数"
                    value={numberOfPages}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 10;
                      if (value >= 3 && value <= 50) {
                        setNumberOfPages(value);
                      }
                    }}
                    inputProps={{
                      min: 3,
                      max: 50,
                      step: 1
                    }}
                    error={numberOfPages < 3 || numberOfPages > 50}
                    helperText={
                      numberOfPages < 3 || numberOfPages > 50
                        ? "页数范围：3-50页"
                        : "建议页数：10-20页"
                    }
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="补充说明（可选）"
                    placeholder="请提供更多背景信息、特殊要求或重点内容..."
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={generateTopicContent}
                        onChange={(e) => setGenerateTopicContent(e.target.checked)}
                        sx={{
                          '&.Mui-checked': {
                            color: theme.palette.primary.main,
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          自动生成主题相关内容
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          开启后，系统会根据主题自动生成相关的演示内容
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>
              </Grid>
            </NeumorphismCard>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Grid container spacing={4}>
              {/* 基础配置 */}
              <Grid item xs={12}>
                <NeumorphismCard>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    ⚙️ 基础配置
                  </Typography>

                  <Alert
                    severity="info"
                    sx={{
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.info.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                    }}
                  >
                    <Typography variant="body2">
                      💡 基础配置已移至主题配置步骤中，您可以在第一步中设置页数和内容生成选项
                    </Typography>
                  </Alert>
                </NeumorphismCard>
              </Grid>

              {/* 参考资料 */}
              <Grid item xs={12}>
                <MultiFormatUpload
                  onContentChange={handleDocumentContentChange}
                  disabled={isUploading}
                />
              </Grid>

              {/* PPT模板 */}
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
                    💡 参考资料是可选的。如果您没有现成的资料，可以开启"智能内容生成"，系统会根据主题自动生成相关内容
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
                    🎯 演示主题
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {topic}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    📄 参考资料
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {documentContent?.type === 'pdf' && documentContent.file?.name}
                    {documentContent?.type === 'text' && documentContent.file?.name}
                    {documentContent?.type === 'input' && '用户直接输入'}
                    {!documentContent && (generateTopicContent ? 'AI智能生成' : '无参考资料')}
                  </Typography>
                  {documentContent?.type === 'input' && documentContent.text && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      内容预览：{documentContent.text.substring(0, 100)}
                      {documentContent.text.length > 100 && '...'}
                    </Typography>
                  )}
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

                {targetAudience && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      👥 目标受众
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {targetAudience}
                    </Typography>
                  </Grid>
                )}

                {presentationStyle && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      🎭 演示风格
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {presentationStyle}
                    </Typography>
                  </Grid>
                )}

                {userContext && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      📝 补充说明
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                      {userContext.length > 100 ? `${userContext.substring(0, 100)}...` : userContext}
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
