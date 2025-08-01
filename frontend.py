#!/usr/bin/env python3
"""
PPTAgent 前端启动脚本
支持自动检测和安装依赖，启动开发服务器
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

def check_node_version():
    """检查Node.js版本"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"✅ Node.js版本: {version}")
            
            # 检查版本是否满足要求 (>=16)
            version_num = int(version.replace('v', '').split('.')[0])
            if version_num < 16:
                print("⚠️  Node.js版本过低，建议升级到16+")
                return False
            return True
        else:
            print("❌ Node.js未安装")
            return False
    except FileNotFoundError:
        print("❌ Node.js未安装")
        return False

def check_pnpm():
    """检查pnpm是否安装"""
    try:
        result = subprocess.run(['pnpm', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"✅ pnpm版本: {version}")
            return True
        else:
            print("❌ pnpm未安装")
            return False
    except FileNotFoundError:
        print("❌ pnpm未安装")
        return False

def install_pnpm():
    """安装pnpm"""
    print("📦 正在安装pnpm...")
    try:
        if platform.system() == "Windows":
            # Windows使用npm安装
            subprocess.run(['npm', 'install', '-g', 'pnpm'], check=True)
        else:
            # Unix系统使用curl安装
            subprocess.run(['curl', '-fsSL', 'https://get.pnpm.io/install.sh', '|', 'sh'], 
                         shell=True, check=True)
        print("✅ pnpm安装成功")
        return True
    except subprocess.CalledProcessError:
        print("❌ pnpm安装失败")
        return False

def install_dependencies():
    """安装项目依赖"""
    frontend_dir = Path(__file__).parent / "frontend"
    
    if not frontend_dir.exists():
        print("❌ frontend目录不存在")
        return False
    
    print("📦 正在安装前端依赖...")
    try:
        os.chdir(frontend_dir)
        subprocess.run(['pnpm', 'install'], check=True)
        print("✅ 依赖安装成功")
        return True
    except subprocess.CalledProcessError:
        print("❌ 依赖安装失败")
        return False

def create_env_file():
    """创建环境变量文件"""
    frontend_dir = Path(__file__).parent / "frontend"
    env_file = frontend_dir / ".env"
    env_example = frontend_dir / ".env.example"
    
    if not env_file.exists() and env_example.exists():
        print("📝 创建环境变量文件...")
        try:
            with open(env_example, 'r', encoding='utf-8') as f:
                content = f.read()
            with open(env_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print("✅ .env文件创建成功")
        except Exception as e:
            print(f"⚠️  .env文件创建失败: {e}")

def start_dev_server():
    """启动开发服务器"""
    frontend_dir = Path(__file__).parent / "frontend"
    
    print("🚀 启动前端开发服务器...")
    print("📍 服务地址: http://localhost:8088")
    print("🔄 代理后端: http://localhost:9297")
    print("💡 使用 Ctrl+C 停止服务")
    print("=" * 50)
    
    try:
        os.chdir(frontend_dir)
        subprocess.run(['pnpm', 'dev'], check=True)
    except KeyboardInterrupt:
        print("\n👋 前端服务已停止")
    except subprocess.CalledProcessError:
        print("❌ 前端服务启动失败")

def main():
    """主函数"""
    print("🎯 PPTAgent 前端启动器")
    print(f"🖥️  操作系统: {platform.system()} {platform.release()}")
    print("=" * 50)
    
    # 检查Node.js
    if not check_node_version():
        print("📝 请先安装Node.js 16+")
        print("🔗 下载地址: https://nodejs.org/")
        sys.exit(1)
    
    # 检查pnpm
    if not check_pnpm():
        print("📦 pnpm未安装，正在尝试安装...")
        if not install_pnpm():
            print("📝 请手动安装pnpm:")
            print("   npm install -g pnpm")
            sys.exit(1)
    
    # 检查前端目录
    frontend_dir = Path(__file__).parent / "frontend"
    if not frontend_dir.exists():
        print("❌ frontend目录不存在")
        print("📝 请确保在项目根目录运行此脚本")
        sys.exit(1)
    
    # 检查package.json
    package_json = frontend_dir / "package.json"
    if not package_json.exists():
        print("❌ package.json不存在")
        print("📝 请确保前端项目已正确创建")
        sys.exit(1)
    
    # 检查node_modules
    node_modules = frontend_dir / "node_modules"
    if not node_modules.exists():
        print("📦 依赖未安装，正在安装...")
        if not install_dependencies():
            sys.exit(1)
    else:
        print("✅ 依赖已安装")
    
    # 创建环境变量文件
    create_env_file()
    
    # 启动开发服务器
    start_dev_server()

if __name__ == "__main__":
    main()
