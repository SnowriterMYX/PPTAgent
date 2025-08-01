# PPTAgent Frontend

基于 React + MUI + Vite + TypeScript 构建的现代化前端界面。

## 🚀 技术栈

- **React 18** - 现代化的前端框架
- **TypeScript** - 类型安全的JavaScript
- **Material-UI (MUI)** - 现代化的UI组件库
- **Vite** - 快速的构建工具
- **Framer Motion** - 流畅的动画库
- **Zustand** - 轻量级状态管理
- **React Router** - 路由管理
- **Axios** - HTTP客户端

## 🎨 设计特色

### 新拟物化设计 (Neumorphism)
- 柔和的阴影效果
- 自然的视觉层次
- 现代化的交互体验

### 响应式布局
- 适配桌面端和移动端
- 流畅的断点切换
- 优化的触摸体验

### 中文本土化
- 完全中文界面
- 符合中文用户习惯
- 本土化的交互设计

## 📁 项目结构

```
frontend/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── common/         # 通用组件
│   │   └── layout/         # 布局组件
│   ├── pages/              # 页面组件
│   ├── hooks/              # 自定义Hooks
│   ├── store/              # 状态管理
│   ├── theme/              # 主题配置
│   ├── types/              # TypeScript类型定义
│   ├── utils/              # 工具函数
│   ├── App.tsx             # 主应用组件
│   └── main.tsx            # 应用入口
├── public/                 # 静态资源
├── package.json            # 依赖配置
├── vite.config.ts          # Vite配置
└── tsconfig.json           # TypeScript配置
```

## 🛠️ 开发指南

### 安装依赖
```bash
cd frontend
pnpm install
```

### 启动开发服务器
```bash
pnpm dev
```

### 构建生产版本
```bash
pnpm build
```

### 代码检查
```bash
pnpm lint
```

## 🔧 配置说明

### 代理配置
开发环境下，前端会自动代理API请求到后端服务：
- API请求: `http://localhost:9297`
- WebSocket: `ws://localhost:9297`

### 环境变量
可以通过 `.env` 文件配置环境变量：
```env
VITE_API_BASE_URL=http://localhost:9297
VITE_WS_BASE_URL=ws://localhost:9297
```

## 🎯 核心功能

### 文件上传
- 拖拽上传支持
- 文件类型验证
- 上传进度显示
- 错误处理

### 实时进度
- WebSocket连接
- 实时进度更新
- 连接状态监控
- 自动重连机制

### 主题系统
- 明暗主题切换
- 新拟物化设计
- 响应式适配
- 动画效果

### 状态管理
- Zustand状态管理
- 持久化存储
- 类型安全
- 开发工具支持

## 🎨 组件库

### NeumorphismCard
新拟物化卡片组件，支持：
- 自动阴影计算
- 交互效果
- 动画支持
- 主题适配

### FileUpload
文件上传组件，支持：
- 拖拽上传
- 多文件选择
- 进度显示
- 错误处理

### NotificationProvider
通知系统，支持：
- 多种通知类型
- 自动消失
- 动画效果
- 操作按钮

## 🔄 API集成

### HTTP请求
- 统一的错误处理
- 请求/响应拦截
- 超时配置
- 重试机制

### WebSocket连接
- 自动重连
- 状态监控
- 消息处理
- 错误恢复

## 📱 响应式设计

### 断点配置
- xs: 0px (手机)
- sm: 600px (平板)
- md: 900px (小桌面)
- lg: 1200px (桌面)
- xl: 1536px (大桌面)

### 适配策略
- 移动优先设计
- 灵活的网格系统
- 自适应组件
- 触摸友好

## 🚀 性能优化

### 代码分割
- 路由级别分割
- 组件懒加载
- 动态导入

### 资源优化
- 图片压缩
- 字体优化
- 缓存策略

### 用户体验
- 加载状态
- 错误边界
- 离线支持

## 🧪 测试

### 单元测试
```bash
pnpm test
```

### E2E测试
```bash
pnpm test:e2e
```

## 📦 部署

### 构建
```bash
pnpm build
```

### 预览
```bash
pnpm preview
```

### Docker部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8088
CMD ["npm", "run", "preview"]
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License
