import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Tabs,
  Tab,
  Paper,
  Alert,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import NeumorphismCard from './NeumorphismCard';
import FileUpload from './FileUpload';

interface MultiFormatUploadProps {
  onContentChange: (content: {
    type: 'pdf' | 'text' | 'input';
    file?: File;
    text?: string;
  }) => void;
  disabled?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`upload-tabpanel-${index}`}
      aria-labelledby={`upload-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const MultiFormatUpload: React.FC<MultiFormatUploadProps> = ({
  onContentChange,
  disabled = false,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [textFiles, setTextFiles] = useState<File[]>([]);
  const [userInput, setUserInput] = useState('');

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const handlePdfChange = useCallback((files: File[]) => {
    setPdfFiles(files);
    if (files.length > 0) {
      onContentChange({ type: 'pdf', file: files[0] });
    }
  }, [onContentChange]);

  const handleTextFileChange = useCallback((files: File[]) => {
    setTextFiles(files);
    if (files.length > 0) {
      onContentChange({ type: 'text', file: files[0] });
    }
  }, [onContentChange]);

  const handleUserInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setUserInput(text);
    if (text.trim()) {
      onContentChange({ type: 'input', text });
    }
  }, [onContentChange]);

  const supportedTextFormats = [
    { ext: '.txt', desc: '纯文本文件' },
    { ext: '.md', desc: 'Markdown文件' },
    { ext: '.docx', desc: 'Word文档' },
    { ext: '.rtf', desc: 'RTF文档' },
  ];

  return (
    <NeumorphismCard>
      <Box sx={{ width: '100%' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          📄 选择文档来源
        </Typography>

        <Paper 
          elevation={0} 
          sx={{ 
            backgroundColor: theme.palette.background.default,
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                minHeight: 60,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab
              icon={<DescriptionIcon />}
              label="PDF文档"
              iconPosition="start"
              disabled={disabled}
            />
            <Tab
              icon={<CloudUploadIcon />}
              label="文本文件"
              iconPosition="start"
              disabled={disabled}
            />
            <Tab
              icon={<EditIcon />}
              label="直接输入"
              iconPosition="start"
              disabled={disabled}
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <FileUpload
              title="上传PDF文档"
              description="支持学术论文、报告、书籍等PDF格式文档"
              accept={['.pdf', 'application/pdf']}
              maxSize={50}
              files={pdfFiles}
              onFilesChange={handlePdfChange}
              disabled={disabled}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box sx={{ mb: 3 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                支持多种文本格式，系统会自动识别并解析文档结构
              </Alert>
              
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                {supportedTextFormats.map((format) => (
                  <Chip
                    key={format.ext}
                    label={`${format.ext} - ${format.desc}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
              </Stack>
            </Box>

            <FileUpload
              title="上传文本文件"
              description="支持 TXT、Markdown、Word 等多种文本格式"
              accept={[
                '.txt', 'text/plain',
                '.md', '.markdown', 'text/markdown',
                '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.rtf', 'application/rtf'
              ]}
              maxSize={20}
              files={textFiles}
              onFilesChange={handleTextFileChange}
              disabled={disabled}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                直接输入您的文档内容，系统会自动识别段落结构并生成PPT
              </Alert>
              
              <TextField
                fullWidth
                multiline
                rows={12}
                placeholder="请输入您的文档内容...

例如：
产品介绍

我们的产品特点
- 功能强大
- 易于使用
- 性价比高

技术优势
我们采用了最新的技术架构，确保产品的稳定性和可扩展性。

市场前景
根据市场调研，我们的产品具有广阔的市场前景..."
                value={userInput}
                onChange={handleUserInputChange}
                disabled={disabled}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: theme.palette.background.paper,
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                  },
                }}
              />
              
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                已输入 {userInput.length} 个字符
                {userInput.length > 0 && ` • 约 ${Math.ceil(userInput.length / 500)} 张幻灯片`}
              </Typography>
            </Box>
          </TabPanel>
        </Paper>
      </Box>
    </NeumorphismCard>
  );
};

export default MultiFormatUpload;
