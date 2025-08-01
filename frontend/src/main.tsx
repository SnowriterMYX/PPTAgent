import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 移除加载屏幕
const removeLoadingScreen = () => {
  const loadingScreen = document.querySelector('.loading-screen');
  if (loadingScreen) {
    loadingScreen.remove();
  }
};

// 渲染应用
ReactDOM.createRoot(document.getElementById('root')!).render(
  // 暂时禁用严格模式以避免WebSocket重复连接问题
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// 应用加载完成后移除加载屏幕
setTimeout(removeLoadingScreen, 500);
