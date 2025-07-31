# PPTAgent 配置指南 🔧

本文档详细说明了如何配置PPTAgent的环境变量，特别是在本地开发环境中使用 `.env` 文件。

## 🚀 快速开始

### 1. 复制配置文件
```bash
# 复制示例配置文件
cp .env.example .env
```

### 2. 编辑配置文件
使用您喜欢的编辑器打开 `.env` 文件并填入实际配置：
```bash
# 使用 VS Code
code .env

# 或使用其他编辑器
vim .env
nano .env
```

### 3. 配置必需的环境变量
```bash
# 最基本的配置
OPENAI_API_KEY=sk-your-actual-api-key-here
LANGUAGE_MODEL=Qwen2.5-72B-Instruct
VISION_MODEL=gpt-4o-2024-08-06
TEXT_MODEL=text-embedding-3-small
```

## 📋 配置选项详解

### 核心配置

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `OPENAI_API_KEY` | ✅ | - | OpenAI API密钥或兼容服务的密钥 |
| `API_BASE` | ❌ | None | 自定义API端点URL |
| `LANGUAGE_MODEL` | ❌ | gpt-4.1 | 语言模型名称 |
| `VISION_MODEL` | ❌ | gpt-4.1 | 视觉模型名称 |
| `TEXT_MODEL` | ❌ | text-embedding-3-small | 文本嵌入模型名称 |

### 推荐模型配置

#### 🏆 最佳性能配置 (OpenAI官方)
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
# API_BASE留空使用官方API
LANGUAGE_MODEL=gpt-4o
VISION_MODEL=gpt-4o
TEXT_MODEL=text-embedding-3-large
```

#### 💰 性价比配置 (OpenRouter推荐)
```bash
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxx
API_BASE=https://openrouter.ai/api/v1
LANGUAGE_MODEL=google/gemini-2.5-flash
VISION_MODEL=google/gemini-2.5-flash
TEXT_MODEL=openai/text-embedding-3-small
```

#### 🧠 高质量配置 (Claude)
```bash
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxx
API_BASE=https://openrouter.ai/api/v1
LANGUAGE_MODEL=anthropic/claude-3.5-sonnet
VISION_MODEL=openai/gpt-4o
TEXT_MODEL=openai/text-embedding-3-small
```

#### 🏠 本地部署配置
```bash
OPENAI_API_KEY=sk-dummy-key
API_BASE=http://localhost:7812/v1
LANGUAGE_MODEL=Qwen2.5-72B-Instruct
VISION_MODEL=Qwen2-VL-7B-Instruct
TEXT_MODEL=bge-m3
```

## 🔧 不同场景的配置示例

### 场景1: 使用OpenAI官方API (稳定可靠)
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
# API_BASE留空
LANGUAGE_MODEL=gpt-4o
VISION_MODEL=gpt-4o
TEXT_MODEL=text-embedding-3-small
```

### 场景2: 使用OpenRouter (推荐，模型选择多)
```bash
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxx
API_BASE=https://openrouter.ai/api/v1
LANGUAGE_MODEL=google/gemini-2.5-flash
VISION_MODEL=google/gemini-2.5-flash
TEXT_MODEL=openai/text-embedding-3-small
```

### 场景3: 使用本地部署的模型
```bash
OPENAI_API_KEY=sk-dummy-key
API_BASE=http://localhost:7812/v1
LANGUAGE_MODEL=Qwen2.5-72B-Instruct
VISION_MODEL=Qwen2-VL-7B-Instruct
TEXT_MODEL=bge-m3
```

### 场景4: 混合配置 (不同模型用不同服务)
```bash
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxx
API_BASE=https://openrouter.ai/api/v1
LANGUAGE_MODEL=anthropic/claude-3.5-sonnet  # 高质量文本
VISION_MODEL=openai/gpt-4o                  # 强大视觉
TEXT_MODEL=openai/text-embedding-3-small   # 标准嵌入
```

## 🛠️ 高级配置

### 开发调试配置
```bash
DEBUG=true
LOG_LEVEL=DEBUG
MAX_RETRY_TIMES=5
REQUEST_TIMEOUT=600
PYTHONIOENCODING=utf-8  # Windows编码支持
```

### 生产环境配置
```bash
DEBUG=false
LOG_LEVEL=INFO
MAX_RETRY_TIMES=3
REQUEST_TIMEOUT=360
ERROR_EXIT=false
RECORD_COST=true
PYTHONIOENCODING=utf-8  # Windows编码支持
```

### 模型缓存配置 (可选)
```bash
# 自定义模型缓存目录
HF_HOME=C:\PPTAgent\models
TRANSFORMERS_CACHE=C:\PPTAgent\models
# 默认缓存位置: C:\Users\{用户名}\.cache\huggingface\hub\
```

## 📁 配置文件位置

PPTAgent会按以下顺序查找 `.env` 文件：

1. 当前工作目录: `./env`
2. 项目根目录: `../env` 
3. UI目录: `pptagent_ui/.env`
4. 系统环境变量

## 🔒 安全注意事项

1. **永远不要提交 `.env` 文件到版本控制系统**
2. **使用强密码和安全的API密钥**
3. **定期轮换API密钥**
4. **在生产环境中使用环境变量而不是文件**

## 🚨 常见问题

### Q: 为什么我的配置没有生效？
A: 检查以下几点：
- `.env` 文件是否在正确的位置
- 变量名是否拼写正确
- 是否有多余的空格或引号
- 重启应用程序

### Q: 如何验证配置是否正确？
A: 启动应用时会显示加载的配置文件路径，并在启动时测试模型连接。

### Q: 可以同时使用多个 `.env` 文件吗？
A: 可以，但只会加载找到的第一个文件。建议使用单一配置文件。

## 📞 获取帮助

如果您在配置过程中遇到问题，请：

1. 检查日志输出中的错误信息
2. 确认API密钥和端点URL正确
3. 查看项目的GitHub Issues
4. 参考项目文档中的最佳实践指南
