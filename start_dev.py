#!/usr/bin/env python3
"""
PPTAgent 本地开发启动脚本
支持自动检测和加载 .env 配置文件
兼容Windows、Linux、macOS
"""

import os
import sys
import platform
import subprocess
from pathlib import Path

def check_env_file():
    """检查 .env 文件是否存在"""
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if not env_file.exists():
        if env_example.exists():
            print("❌ 未找到 .env 文件")
            print("📋 请先复制配置文件模板:")
            print(f"   cp {env_example} {env_file}")
            print("📝 然后编辑 .env 文件，填入您的API密钥和模型配置")
            return False
        else:
            print("❌ 未找到 .env 和 .env.example 文件")
            print("📝 请手动创建 .env 文件并配置必要的环境变量")
            return False
    
    print(f"✅ 找到配置文件: {env_file}")
    return True

def check_system_dependencies():
    """检查系统依赖"""
    print("\n🔍 检查系统依赖...")

    # 检查LibreOffice
    soffice_found = False
    if platform.system() == "Windows":
        possible_paths = [
            "soffice",
            "soffice.exe",
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]
        for path in possible_paths:
            if subprocess.run(["where", path], capture_output=True, shell=True).returncode == 0 or os.path.exists(path):
                soffice_found = True
                print(f"✅ LibreOffice found: {path}")
                break
    else:
        if subprocess.run(["which", "soffice"], capture_output=True).returncode == 0:
            soffice_found = True
            print("✅ LibreOffice found")

    if not soffice_found:
        print("⚠️  LibreOffice not found - PPT conversion may not work")
        if platform.system() == "Windows":
            print("   请从 https://www.libreoffice.org/download/ 下载安装")

    # 检查Chrome/Edge
    chrome_found = False
    if platform.system() == "Windows":
        possible_browsers = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ]
        for browser in possible_browsers:
            if os.path.exists(browser):
                chrome_found = True
                print(f"✅ Browser found: {os.path.basename(browser)}")
                break
    else:
        for cmd in ["google-chrome", "chromium-browser", "chromium"]:
            if subprocess.run(["which", cmd], capture_output=True).returncode == 0:
                chrome_found = True
                print(f"✅ Browser found: {cmd}")
                break

    if not chrome_found:
        print("⚠️  Chrome/Edge not found - HTML to image conversion may not work")

    return soffice_found and chrome_found

def check_required_vars():
    """检查必需的环境变量"""
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
        print("📝 请在 .env 文件中配置这些变量")
        return False

    print("✅ 环境变量检查通过")
    return True

def show_config():
    """显示当前配置"""
    from dotenv import load_dotenv
    load_dotenv()
    
    print("\n📋 当前配置:")
    config_vars = [
        "OPENAI_API_KEY",
        "API_BASE", 
        "LANGUAGE_MODEL",
        "VISION_MODEL",
        "TEXT_MODEL",
        "DEBUG"
    ]
    
    for var in config_vars:
        value = os.environ.get(var, "未设置")
        if var == "OPENAI_API_KEY" and value != "未设置":
            # 隐藏API密钥的大部分内容
            value = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
        print(f"   {var}: {value}")

def start_backend():
    """启动后端服务"""
    print("\n🚀 启动后端服务...")

    # 检查pptagent_ui目录是否存在
    if not os.path.exists("pptagent_ui"):
        print("❌ 未找到 pptagent_ui 目录")
        return False

    original_dir = os.getcwd()
    try:
        os.chdir("pptagent_ui")

        # Windows下可能需要特殊处理
        if platform.system() == "Windows":
            print("🪟 Windows环境检测到，使用兼容模式启动...")

        print(f"📍 当前目录: {os.getcwd()}")
        print(f"🐍 Python路径: {sys.executable}")

        subprocess.run([sys.executable, "backend.py"], check=True)

    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    except subprocess.CalledProcessError as e:
        print(f"❌ 后端启动失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 启动过程中出现错误: {e}")
        return False
    finally:
        os.chdir(original_dir)

    return True

def main():
    """主函数"""
    print("🎯 PPTAgent 本地开发环境启动器")
    print(f"🖥️  操作系统: {platform.system()} {platform.release()}")
    print("=" * 50)

    # 检查 .env 文件
    if not check_env_file():
        sys.exit(1)

    # 检查系统依赖
    deps_ok = check_system_dependencies()
    if not deps_ok:
        print("\n⚠️  系统依赖检查未完全通过，但可以继续运行")
        if platform.system() == "Windows":
            print("📖 请参考 WINDOWS_SETUP.md 获取详细安装指南")

    # 检查必需的环境变量
    if not check_required_vars():
        sys.exit(1)

    # 显示当前配置
    show_config()

    # 询问是否继续
    print("\n❓ 是否启动服务? (y/N): ", end="")
    response = input().strip().lower()

    if response not in ['y', 'yes']:
        print("👋 已取消启动")
        sys.exit(0)

    # 启动后端服务
    start_backend()

if __name__ == "__main__":
    main()
