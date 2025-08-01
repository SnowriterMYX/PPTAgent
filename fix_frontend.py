#!/usr/bin/env python3
"""
修复前端依赖和配置问题
"""

import os
import subprocess
import sys
from pathlib import Path

def main():
    print("🔧 修复PPTAgent前端配置...")
    
    # 切换到前端目录
    frontend_dir = Path(__file__).parent / "frontend"
    if not frontend_dir.exists():
        print("❌ frontend目录不存在")
        return False
    
    os.chdir(frontend_dir)
    print(f"📍 当前目录: {os.getcwd()}")
    
    try:
        # 安装@types/node依赖
        print("📦 安装@types/node依赖...")
        subprocess.run(['pnpm', 'add', '-D', '@types/node'], check=True)
        
        # 重新安装所有依赖
        print("📦 重新安装依赖...")
        subprocess.run(['pnpm', 'install'], check=True)
        
        print("✅ 依赖安装完成")
        
        # 启动开发服务器
        print("🚀 启动开发服务器...")
        subprocess.run(['pnpm', 'dev'], check=True)
        
    except subprocess.CalledProcessError as e:
        print(f"❌ 操作失败: {e}")
        return False
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    
    return True

if __name__ == "__main__":
    main()
