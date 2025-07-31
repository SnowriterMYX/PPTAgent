#!/usr/bin/env python3
"""
PPTAgent 安全启动脚本
解决 oaib 库导致的 Ctrl+C 停止问题
"""

import asyncio
import os
import signal
import sys
import traceback
from pathlib import Path

def setup_signal_handlers():
    """设置信号处理器"""
    def signal_handler(signum, frame):
        print(f"\n🛑 接收到信号 {signum}，正在强制退出...")
        # 强制退出，不等待清理
        os._exit(0)
    
    # 注册信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

def check_environment():
    """检查环境配置"""
    # 检查 .env 文件
    env_file = Path(".env")
    if not env_file.exists():
        print("❌ 未找到 .env 文件")
        print("📝 请先创建 .env 文件并配置必要的环境变量")
        return False
    
    # 检查必需的环境变量
    from dotenv import load_dotenv
    load_dotenv()
    
    required_vars = ["OPENAI_API_KEY"]
    missing_vars = []
    
    for var in required_vars:
        if not os.environ.get(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("❌ 缺少必需的环境变量:")
        for var in missing_vars:
            print(f"   - {var}")
        return False
    
    return True

async def start_server():
    """启动服务器"""
    try:
        # 导入并启动服务器
        import uvicorn
        from pptagent_ui.backend import app
        
        print("🚀 启动PPTAgent后端服务...")
        print("📝 使用 Ctrl+C 可以强制停止服务")
        print("=" * 50)
        
        # 配置 uvicorn
        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=9297,
            log_level="info",
            access_log=True,
        )
        
        server = uvicorn.Server(config)
        await server.serve()
        
    except KeyboardInterrupt:
        print("\n🛑 接收到中断信号，正在停止服务...")
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        traceback.print_exc()
    finally:
        print("👋 服务已停止")

def main():
    """主函数"""
    print("🎯 PPTAgent 安全启动器")
    print("🔧 解决 oaib 库导致的停止问题")
    print("=" * 50)
    
    # 设置信号处理器
    setup_signal_handlers()
    
    # 检查环境
    if not check_environment():
        sys.exit(1)
    
    # 检查是否在正确的目录
    if not os.path.exists("pptagent_ui"):
        print("❌ 未找到 pptagent_ui 目录")
        print("📁 请确保在项目根目录下运行此脚本")
        sys.exit(1)
    
    try:
        # 启动服务器
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("\n🛑 强制退出")
        os._exit(0)
    except Exception as e:
        print(f"❌ 启动过程中出现错误: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
