#!/usr/bin/env python3
"""
PPTAgent 全栈启动脚本
同时启动后端和前端服务
"""

import os
import sys
import subprocess
import threading
import time
import signal
import platform
from pathlib import Path

class FullStackLauncher:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.running = True
        
    def signal_handler(self, signum, frame):
        """处理中断信号"""
        print(f"\n🛑 接收到信号 {signum}，正在停止服务...")
        self.stop_services()
        sys.exit(0)
    
    def check_dependencies(self):
        """检查依赖"""
        print("🔍 检查系统依赖...")
        
        # 检查Python
        python_version = sys.version_info
        if python_version < (3, 11):
            print(f"❌ Python版本过低: {python_version.major}.{python_version.minor}")
            print("📝 需要Python 3.11+")
            return False
        print(f"✅ Python版本: {python_version.major}.{python_version.minor}.{python_version.micro}")
        
        # 检查Node.js
        try:
            result = subprocess.run(['node', '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                version = result.stdout.strip()
                print(f"✅ Node.js版本: {version}")
            else:
                print("❌ Node.js未安装")
                return False
        except FileNotFoundError:
            print("❌ Node.js未安装")
            return False
        
        # 检查pnpm
        try:
            result = subprocess.run(['pnpm', '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                version = result.stdout.strip()
                print(f"✅ pnpm版本: {version}")
            else:
                print("❌ pnpm未安装")
                return False
        except FileNotFoundError:
            print("❌ pnpm未安装")
            return False
        
        return True
    
    def check_backend_dependencies(self):
        """检查后端依赖"""
        print("🔍 检查后端依赖...")
        
        # 检查虚拟环境
        venv_path = Path("venv")
        if not venv_path.exists():
            print("⚠️  虚拟环境不存在，建议创建虚拟环境")
        
        # 检查pptagent包
        try:
            import pptagent
            print("✅ pptagent包已安装")
            return True
        except ImportError:
            print("❌ pptagent包未安装")
            print("📝 请运行: pip install -e .")
            return False
    
    def check_frontend_dependencies(self):
        """检查前端依赖"""
        print("🔍 检查前端依赖...")
        
        frontend_dir = Path("frontend")
        if not frontend_dir.exists():
            print("❌ frontend目录不存在")
            return False
        
        node_modules = frontend_dir / "node_modules"
        if not node_modules.exists():
            print("❌ 前端依赖未安装")
            print("📝 请运行: cd frontend && pnpm install")
            return False
        
        print("✅ 前端依赖已安装")
        return True
    
    def start_backend(self):
        """启动后端服务"""
        print("🚀 启动后端服务...")
        
        try:
            # 检查是否在虚拟环境中
            if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
                python_cmd = 'python'
            else:
                # 尝试使用虚拟环境的Python
                venv_python = Path("venv/Scripts/python.exe" if platform.system() == "Windows" else "venv/bin/python")
                if venv_python.exists():
                    python_cmd = str(venv_python)
                else:
                    python_cmd = sys.executable
            
            # 启动后端
            backend_script = Path("backend.py")
            if backend_script.exists():
                self.backend_process = subprocess.Popen(
                    [python_cmd, str(backend_script)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    bufsize=1
                )
                print("✅ 后端服务启动成功")
                return True
            else:
                print("❌ 后端脚本不存在")
                return False
                
        except Exception as e:
            print(f"❌ 后端启动失败: {e}")
            return False
    
    def start_frontend(self):
        """启动前端服务"""
        print("🚀 启动前端服务...")
        
        try:
            frontend_dir = Path("frontend")
            self.frontend_process = subprocess.Popen(
                ['pnpm', 'dev'],
                cwd=frontend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            print("✅ 前端服务启动成功")
            return True
            
        except Exception as e:
            print(f"❌ 前端启动失败: {e}")
            return False
    
    def monitor_processes(self):
        """监控进程状态"""
        def monitor_backend():
            if self.backend_process:
                for line in iter(self.backend_process.stdout.readline, ''):
                    if self.running:
                        print(f"[后端] {line.rstrip()}")
                    else:
                        break
        
        def monitor_frontend():
            if self.frontend_process:
                for line in iter(self.frontend_process.stdout.readline, ''):
                    if self.running:
                        print(f"[前端] {line.rstrip()}")
                    else:
                        break
        
        # 启动监控线程
        if self.backend_process:
            backend_thread = threading.Thread(target=monitor_backend, daemon=True)
            backend_thread.start()
        
        if self.frontend_process:
            frontend_thread = threading.Thread(target=monitor_frontend, daemon=True)
            frontend_thread.start()
    
    def wait_for_services(self):
        """等待服务启动"""
        print("⏳ 等待服务启动...")
        time.sleep(3)
        
        # 检查后端服务
        try:
            import requests
            response = requests.get("http://localhost:9297/", timeout=5)
            if response.status_code == 200:
                print("✅ 后端服务就绪")
            else:
                print("⚠️  后端服务响应异常")
        except Exception:
            print("⚠️  后端服务连接失败")
        
        print("🌐 服务地址:")
        print("   前端: http://localhost:8088")
        print("   后端: http://localhost:9297")
        print("💡 使用 Ctrl+C 停止所有服务")
    
    def stop_services(self):
        """停止所有服务"""
        self.running = False
        
        if self.backend_process:
            print("🛑 停止后端服务...")
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend_process.kill()
        
        if self.frontend_process:
            print("🛑 停止前端服务...")
            self.frontend_process.terminate()
            try:
                self.frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.frontend_process.kill()
        
        print("✅ 所有服务已停止")
    
    def run(self):
        """运行全栈应用"""
        # 注册信号处理器
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        print("🎯 PPTAgent 全栈启动器")
        print(f"🖥️  操作系统: {platform.system()} {platform.release()}")
        print("=" * 50)
        
        # 检查依赖
        if not self.check_dependencies():
            print("❌ 系统依赖检查失败")
            return False
        
        if not self.check_backend_dependencies():
            print("❌ 后端依赖检查失败")
            return False
        
        if not self.check_frontend_dependencies():
            print("❌ 前端依赖检查失败")
            return False
        
        # 启动服务
        if not self.start_backend():
            print("❌ 后端启动失败")
            return False
        
        # 等待后端启动
        time.sleep(2)
        
        if not self.start_frontend():
            print("❌ 前端启动失败")
            self.stop_services()
            return False
        
        # 监控进程
        self.monitor_processes()
        
        # 等待服务就绪
        self.wait_for_services()
        
        try:
            # 保持运行
            while self.running:
                time.sleep(1)
                
                # 检查进程状态
                if self.backend_process and self.backend_process.poll() is not None:
                    print("❌ 后端进程意外退出")
                    break
                
                if self.frontend_process and self.frontend_process.poll() is not None:
                    print("❌ 前端进程意外退出")
                    break
                    
        except KeyboardInterrupt:
            pass
        finally:
            self.stop_services()
        
        return True

def main():
    launcher = FullStackLauncher()
    success = launcher.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
