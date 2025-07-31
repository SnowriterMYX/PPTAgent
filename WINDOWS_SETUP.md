# PPTAgent Windows 安装指南 🪟

本指南将帮助您在Windows环境下成功安装和配置PPTAgent。

## 📋 系统要求

- **操作系统**: Windows 10/11 (64位)
- **Python**: 3.11+ 
- **内存**: 最少8GB RAM
- **存储**: 至少5GB可用空间

## 🛠️ 必需软件安装

### 1. Python 3.11+

从官网下载并安装Python：
- 访问 https://www.python.org/downloads/
- 下载Python 3.11或更高版本
- **重要**: 安装时勾选 "Add Python to PATH"

验证安装：
```powershell
python --version
pip --version
```

### 2. LibreOffice (必需)

PPTAgent需要LibreOffice来处理PPT文件转换。

**下载安装：**
- 访问 https://www.libreoffice.org/download/download/
- 下载Windows版本并安装
- 安装完成后，LibreOffice会自动添加到系统PATH

**验证安装：**
```powershell
# 在命令行中测试
soffice --version
```

如果命令不被识别，请手动添加LibreOffice到PATH：
1. 找到LibreOffice安装目录（通常是 `C:\Program Files\LibreOffice\program\`）
2. 将该路径添加到系统环境变量PATH中

### 3. Google Chrome 或 Microsoft Edge (推荐)

用于HTML到图片的转换：
- **Chrome**: https://www.google.com/chrome/
- **Edge**: 通常Windows 10/11已预装

### 4. Poppler (PDF处理)

**使用conda安装（推荐）：**
```powershell
# 如果使用conda
conda install -c conda-forge poppler
```

**或者手动安装：**
1. 下载Poppler Windows版本：https://github.com/oschwartz10612/poppler-windows/releases
2. 解压到 `C:\poppler`
3. 将 `C:\poppler\Library\bin` 添加到系统PATH

**验证安装：**
```powershell
pdftoppm -h
```

## 🚀 PPTAgent 安装

### 1. 克隆项目
```powershell
git clone https://github.com/icip-cas/PPTAgent.git
cd PPTAgent
```

### 2. 创建虚拟环境（推荐）
```powershell
python -m venv venv
venv\Scripts\activate
```

### 3. 安装依赖
```powershell
pip install -e .
```

### 4. 配置环境变量
```powershell
# 复制配置文件
copy .env.example .env

# 编辑 .env 文件
notepad .env
```

在 `.env` 文件中配置：
```bash
# 必需配置
OPENAI_API_KEY=sk-your-api-key-here

# 模型配置
LANGUAGE_MODEL=Qwen2.5-72B-Instruct
VISION_MODEL=gpt-4o-2024-08-06
TEXT_MODEL=text-embedding-3-small

# 如果使用本地API服务
API_BASE=http://localhost:7812/v1
```

## 🧪 测试安装

### 1. 使用开发启动脚本
```powershell
python start_dev.py
```

### 2. 手动测试
```powershell
cd pptagent_ui
python backend.py
```

如果看到以下信息说明安装成功：
```
✅ 已加载环境变量文件: .env
✅ Found LibreOffice at: C:\Program Files\LibreOffice\program\soffice.exe
✅ 环境变量检查通过
```

## 🔧 常见问题解决

### Q1: LibreOffice未找到
**错误**: `LibreOffice (soffice) is not found`

**解决方案**:
1. 确认LibreOffice已正确安装
2. 检查PATH环境变量是否包含LibreOffice路径
3. 重启命令行窗口

### Q2: Poppler未找到
**错误**: `pdf2image` 相关错误

**解决方案**:
```powershell
# 使用conda安装
conda install -c conda-forge poppler

# 或者设置环境变量
set PATH=%PATH%;C:\poppler\Library\bin
```

### Q3: Chrome路径问题
**错误**: html2image相关错误

**解决方案**:
- 确保Chrome或Edge已安装
- PPTAgent会自动检测浏览器路径
- 如果仍有问题，可以手动指定浏览器路径

### Q4: 权限问题
**错误**: 文件访问权限错误

**解决方案**:
```powershell
# 以管理员身份运行PowerShell
# 或者修改项目文件夹权限
```

### Q5: 中文路径问题
**错误**: 路径包含中文字符导致的错误

**解决方案**:
- 避免在包含中文字符的路径下安装PPTAgent
- 使用英文路径，如 `C:\PPTAgent\`

## 🎯 性能优化建议

### 1. 使用SSD存储
- 将项目放在SSD上以提高I/O性能

### 2. 增加虚拟内存
- 如果内存不足，适当增加虚拟内存大小

### 3. 关闭不必要的程序
- 运行PPTAgent时关闭其他占用内存的程序

### 4. 使用GPU加速
- 如果有NVIDIA GPU，确保安装了CUDA支持

## 📞 获取帮助

如果遇到问题：

1. **检查日志输出** - 查看详细的错误信息
2. **查看GitHub Issues** - 搜索类似问题的解决方案
3. **更新依赖** - 确保所有依赖都是最新版本

## 🔄 更新PPTAgent

```powershell
# 拉取最新代码
git pull

# 更新依赖
pip install -e . --upgrade
```

## 🎉 开始使用

安装完成后，您可以：

1. **启动Web界面**:
   ```powershell
   python start_dev.py
   ```

2. **访问界面**: 打开浏览器访问 `http://localhost:9297`

3. **上传文件**: 上传PPT模板和PDF文档开始生成

祝您使用愉快！🚀
