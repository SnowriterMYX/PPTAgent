@echo off
chcp 65001 >nul
title PPTAgent Windows 启动器

echo.
echo 🎯 PPTAgent Windows 启动器
echo ================================

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 未安装或未添加到PATH
    echo 请从 https://www.python.org/downloads/ 下载安装Python 3.11+
    pause
    exit /b 1
)

echo ✅ Python 已安装

REM 检查虚拟环境
if exist "venv\Scripts\activate.bat" (
    echo ✅ 发现虚拟环境，正在激活...
    call venv\Scripts\activate.bat
) else (
    echo ⚠️  未发现虚拟环境
    echo 是否创建虚拟环境? (y/N):
    set /p create_venv=
    if /i "%create_venv%"=="y" (
        echo 🔧 创建虚拟环境...
        python -m venv venv
        call venv\Scripts\activate.bat
        echo ✅ 虚拟环境创建完成
    )
)

REM 检查.env文件
if not exist ".env" (
    echo ⚠️  未找到 .env 配置文件
    if exist ".env.example" (
        echo 📋 复制配置文件模板...
        copy ".env.example" ".env"
        echo ✅ 已创建 .env 文件
        echo 📝 请编辑 .env 文件，填入您的API密钥
        notepad .env
    ) else (
        echo ❌ 未找到 .env.example 文件
        echo 请手动创建 .env 文件
        pause
        exit /b 1
    )
)

REM 检查依赖是否安装
echo 🔍 检查依赖安装...
python -c "import pptagent" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PPTAgent 未安装，正在安装依赖...
    pip install -e .
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
)

REM 启动应用
echo.
echo 🚀 启动 PPTAgent...
echo 按 Ctrl+C 停止服务
echo.

python start_dev.py

echo.
echo 👋 服务已停止
pause
