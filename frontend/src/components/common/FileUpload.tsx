import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  LinearProgress,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import NeumorphismCard from './NeumorphismCard';
import { fileUtils } from '@/utils/api';

interface FileUploadProps {
  // 接受的文件类型
  accept: string[];
  // 是否允许多文件
  multiple?: boolean;
  // 最大文件大小 (MB)
  maxSize?: number;
  // 已选择的文件
  files: File[];
  // 文件选择回调
  onFilesChange: (files: File[]) => void;
  // 上传进度 (0-100)
  uploadProgress?: number;
  // 是否禁用
  disabled?: boolean;
  // 标题
  title: string;
  // 描述
  description?: string;
  // 错误信息
  error?: string;
  // 是否必需
  required?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  multiple = false,
  maxSize = 50,
  files,
  onFilesChange,
  uploadProgress,
  disabled = false,
  title,
  description,
  error,
  required = false,
}) => {
  const theme = useTheme();
  const [dragActive, setDragActive] = useState(false);

  // 文件验证
  const validateFile = useCallback((file: File): string | null => {
    // 检查文件类型
    if (!fileUtils.validateFileType(file, accept)) {
      return `不支持的文件类型。支持的格式：${accept.join(', ')}`;
    }

    // 检查文件大小
    if (!fileUtils.validateFileSize(file, maxSize)) {
      return `文件大小超过限制。最大允许：${maxSize}MB`;
    }

    return null;
  }, [accept, maxSize]);

  // 处理文件选择
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setDragActive(false);

    // 处理被拒绝的文件
    if (rejectedFiles.length > 0) {
      console.warn('Rejected files:', rejectedFiles);
    }

    // 验证文件
    const validFiles: File[] = [];
    const errors: string[] = [];

    acceptedFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      console.error('File validation errors:', errors);
      // 这里可以通过props传递错误处理函数
    }

    // 更新文件列表
    if (multiple) {
      onFilesChange([...files, ...validFiles]);
    } else {
      onFilesChange(validFiles.slice(0, 1));
    }
  }, [files, multiple, onFilesChange, validateFile]);

  // 配置dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.reduce((acc, type) => {
      if (type.startsWith('.')) {
        // 文件扩展名
        acc[`application/${type.slice(1)}`] = [type];
      } else {
        // MIME类型
        acc[type] = [];
      }
      return acc;
    }, {} as Record<string, string[]>),
    multiple,
    disabled: disabled || uploadProgress !== undefined,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  // 移除文件
  const removeFile = useCallback((index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  }, [files, onFilesChange]);

  // 获取文件图标
  const getFileIcon = (file: File) => {
    if (file.type.includes('pdf')) {
      return <FileIcon sx={{ color: '#f40f02' }} />;
    }
    if (file.type.includes('powerpoint') || file.name.endsWith('.pptx')) {
      return <FileIcon sx={{ color: '#d24726' }} />;
    }
    return <FileIcon />;
  };

  const isUploading = uploadProgress !== undefined && uploadProgress < 100;
  const hasFiles = files.length > 0;

  return (
    <Box>
      {/* 标题 */}
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
        {title}
        {required && (
          <Box component="span" sx={{ color: 'error.main' }}> *</Box>
        )}
      </Typography>

      {/* 描述 */}
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.5 }}>
          {description}
        </Typography>
      )}

      {/* 上传区域 */}
      <NeumorphismCard
        interactive={!disabled && !isUploading}
        pressed={dragActive || isDragActive}
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 3,
          border: error
            ? `2px dashed ${theme.palette.error.main}`
            : dragActive || isDragActive
            ? `2px dashed ${theme.palette.primary.main}`
            : `2px dashed ${alpha(theme.palette.divider, 0.5)}`,
          backgroundColor: dragActive || isDragActive
            ? alpha(theme.palette.primary.main, 0.05)
            : alpha(theme.palette.background.paper, 0.5),
          transition: 'all 0.3s ease',
          cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          '&:hover': !disabled && !isUploading ? {
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.02),
          } : {},
        }}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        
        <motion.div
          animate={{
            scale: dragActive || isDragActive ? 1.05 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          <CloudUploadIcon
            sx={{
              fontSize: 56,
              color: dragActive || isDragActive
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
              mb: 2,
            }}
          />

          <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
            {dragActive || isDragActive
              ? '释放文件以上传'
              : hasFiles && !multiple
              ? '点击或拖拽文件来替换'
              : '点击或拖拽文件到此处'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
            支持格式：{accept.map(type => type.replace('.', '').toUpperCase()).join(', ')} | 最大{maxSize}MB
          </Typography>
        </motion.div>
      </NeumorphismCard>

      {/* 上传进度 */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                上传进度：{uploadProgress}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 已选择的文件列表 */}
      <AnimatePresence>
        {hasFiles && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                已选择的文件：
              </Typography>
              {files.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Chip
                    icon={getFileIcon(file)}
                    label={`${file.name} (${fileUtils.formatFileSize(file.size)})`}
                    onDelete={!disabled && !isUploading ? () => removeFile(index) : undefined}
                    deleteIcon={<DeleteIcon />}
                    sx={{
                      m: 0.5,
                      maxWidth: '100%',
                      '& .MuiChip-label': {
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                    color={uploadProgress === 100 ? 'success' : 'default'}
                  />
                </motion.div>
              ))}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误信息 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default FileUpload;
