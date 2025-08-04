import asyncio
import hashlib
import importlib
import json
import os
import signal
import sys
import threading
import time
import traceback
import uuid

import chardet
import docx
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import pptagent.induct as induct
import pptagent.pptgen as pptgen
from pptagent.document import Document
from pptagent.llms import llm_logger
from pptagent.model_utils import ModelManager, parse_pdf
from pptagent.multimodal import ImageLabler
from pptagent.presentation import Presentation
from pptagent.utils import Config, get_logger, package_join, pjoin, ppt_to_images_async

# 加载环境变量
# 首先尝试从当前目录加载 .env 文件
env_paths = [
    Path.cwd() / ".env",  # 当前工作目录
    Path(__file__).parent.parent / ".env",  # 项目根目录
    Path(__file__).parent / ".env",  # UI目录
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ 已加载环境变量文件: {env_path}")
        break
else:
    # 如果没有找到 .env 文件，尝试加载默认位置
    load_dotenv()
    print("⚠️  未找到 .env 文件，使用系统环境变量")

# constants
DEBUG = os.environ.get("DEBUG", "true").lower() == "true" if len(sys.argv) == 1 else False
RUNS_DIR = package_join("runs")
STAGES = [
    "PPT Parsing",
    "PDF Parsing",
    "PPT Analysis",
    "PPT Generation",
    "Success!",
]

# 初始化模型管理器
models = ModelManager()

# 全局变量用于优雅关闭
shutdown_event = asyncio.Event()
_shutdown_in_progress = False

def signal_handler(signum, frame):
    """处理 Ctrl+C 信号"""
    global _shutdown_in_progress
    if _shutdown_in_progress:
        print(f"\n⚠️  已在关闭中，请稍等...")
        return

    _shutdown_in_progress = True
    print(f"\n🛑 接收到信号 {signum}，正在优雅关闭服务...")
    shutdown_event.set()

    # 如果在主线程中，可以直接退出
    if threading.current_thread() is threading.main_thread():
        # 给一些时间让清理完成
        time.sleep(2)
        print("🔄 强制退出...")
        os._exit(0)

# 注册信号处理器
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

@asynccontextmanager
async def lifespan(_: FastAPI):
    # 测试模型连接，但不强制要求成功（开发模式）
    print("🚀 启动PPTAgent后端服务...")

    # 创建必要的目录
    os.makedirs(RUNS_DIR, exist_ok=True)
    os.makedirs(pjoin(RUNS_DIR, "feedback"), exist_ok=True)
    print("📁 已创建必要的目录结构")

    connection_ok = await models.test_connections()
    if connection_ok:
        print("✅ 所有模型连接测试通过")
    else:
        print("⚠️  模型连接测试失败，但继续启动（开发模式）")
        print("📝 请检查 .env 文件中的API配置")
        print("💡 您可以稍后在界面中测试模型连接")

    yield

    # 优雅关闭处理
    print("🔄 正在清理资源...")
    try:
        # 设置清理超时时间
        cleanup_timeout = 10  # 10秒超时

        # 清理模型资源（带超时）
        if hasattr(models, 'cleanup'):
            try:
                await asyncio.wait_for(models.cleanup(), timeout=cleanup_timeout)
            except asyncio.TimeoutError:
                logger.warning("模型清理超时，强制继续")
            except Exception as e:
                logger.error(f"模型清理出错: {e}")

        # 等待所有活跃连接关闭（带超时）
        if active_connections:
            print(f"⏳ 等待 {len(active_connections)} 个活跃连接关闭...")
            close_tasks = []
            for task_id, websocket in list(active_connections.items()):
                if websocket:
                    close_tasks.append(websocket.close())

            if close_tasks:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*close_tasks, return_exceptions=True),
                        timeout=5
                    )
                except asyncio.TimeoutError:
                    logger.warning("WebSocket连接关闭超时")

            active_connections.clear()

        print("✅ 资源清理完成")
    except Exception as e:
        logger.error(f"清理资源时出错: {e}")
    finally:
        print("👋 PPTAgent后端服务已停止")


# server
logger = get_logger(__name__)
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
progress_store: dict[str, dict] = {}
active_connections: dict[str, WebSocket] = {}


class ProgressManager:
    def __init__(self, task_id: str, stages: list[str], debug: bool = True):
        self.task_id = task_id
        self.stages = stages
        self.debug = debug
        self.task_id = task_id
        self.failed = False
        self.current_stage = 0
        self.total_stages = len(stages)

    async def report_progress(self):
        assert (
            self.task_id in active_connections
        ), "WebSocket connection is already closed"
        self.current_stage += 1
        progress = int((self.current_stage / self.total_stages) * 100)
        await send_progress(
            active_connections[self.task_id],
            f"Stage: {self.stages[self.current_stage - 1]}",
            progress,
        )

    async def fail_stage(self, error_message: str):
        await send_progress(
            active_connections[self.task_id],
            f"{self.stages[self.current_stage]} Error: {error_message}",
            100,
        )
        self.failed = True
        active_connections.pop(self.task_id, None)
        if self.debug:
            logger.error(
                f"{self.task_id}: {self.stages[self.current_stage]} Error: {error_message}"
            )


@app.post("/api/upload")
async def create_task(
    pptxFile: UploadFile = File(None),
    pdfFile: UploadFile = File(None),
    textFile: UploadFile = File(None),  # 新增：支持文本文件
    topic: str = Form(...),  # 改为必填
    userInput: str = Form(None),  # 新增：支持用户直接输入
    numberOfPages: int = Form(...),
    # 新增：主题配置参数
    targetAudience: str = Form(None),
    presentationStyle: str = Form(None),
    userContext: str = Form(None),
    generateTopicContent: bool = Form(True),
):
    task_id = datetime.now().strftime("20%y-%m-%d") + "/" + str(uuid.uuid4())
    logger.info(f"task created: {task_id}")
    os.makedirs(pjoin(RUNS_DIR, task_id))
    task = {
        "numberOfPages": numberOfPages,
        "pptx": "default_template",
    }
    if pptxFile is not None:
        pptx_blob = await pptxFile.read()
        pptx_md5 = hashlib.md5(pptx_blob).hexdigest()
        task["pptx"] = pptx_md5
        pptx_dir = pjoin(RUNS_DIR, "pptx", pptx_md5)
        if not os.path.exists(pptx_dir):
            os.makedirs(pptx_dir, exist_ok=True)
            with open(pjoin(pptx_dir, "source.pptx"), "wb") as f:
                f.write(pptx_blob)
    if pdfFile is not None:
        pdf_blob = await pdfFile.read()
        pdf_md5 = hashlib.md5(pdf_blob).hexdigest()
        task["pdf"] = pdf_md5
        pdf_dir = pjoin(RUNS_DIR, "pdf", pdf_md5)
        if not os.path.exists(pdf_dir):
            os.makedirs(pdf_dir, exist_ok=True)
            with open(pjoin(pdf_dir, "source.pdf"), "wb") as f:
                f.write(pdf_blob)

    # 处理文本文件上传
    if textFile is not None:
        text_blob = await textFile.read()
        text_md5 = hashlib.md5(text_blob).hexdigest()
        task["textFile"] = text_md5
        task["textFileName"] = textFile.filename
        text_dir = pjoin(RUNS_DIR, "text", text_md5)
        if not os.path.exists(text_dir):
            os.makedirs(text_dir, exist_ok=True)
            # 保存原始文件
            file_ext = os.path.splitext(textFile.filename)[1].lower()
            source_filename = f"source{file_ext}"
            with open(pjoin(text_dir, source_filename), "wb") as f:
                f.write(text_blob)

    # 处理用户直接输入
    if userInput is not None and userInput.strip():
        input_md5 = hashlib.md5(userInput.encode('utf-8')).hexdigest()
        task["userInput"] = input_md5
        input_dir = pjoin(RUNS_DIR, "input", input_md5)
        if not os.path.exists(input_dir):
            os.makedirs(input_dir, exist_ok=True)
            # 保存用户输入为文本文件
            with open(pjoin(input_dir, "user_input.txt"), "w", encoding="utf-8") as f:
                f.write(userInput)

    # 保存主题配置
    task["topic"] = topic
    if targetAudience:
        task["targetAudience"] = targetAudience
    if presentationStyle:
        task["presentationStyle"] = presentationStyle
    if userContext:
        task["userContext"] = userContext
    task["generateTopicContent"] = generateTopicContent

    progress_store[task_id] = task
    # Start the PPT generation task asynchronously
    asyncio.create_task(ppt_gen(task_id))
    return {"task_id": task_id.replace("/", "|")}


async def send_progress(websocket: Optional[WebSocket], status: str, progress: int):
    if websocket is None:
        logger.info(f"websocket is None, status: {status}, progress: {progress}")
        return
    try:
        await websocket.send_json({"progress": progress, "status": status})
    except Exception as e:
        logger.warning(f"Failed to send progress: {e}")
        # WebSocket已断开，不需要抛出异常


@app.websocket("/wsapi/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    original_task_id = task_id
    task_id = task_id.replace("|", "/")
    logger.info(f"WebSocket connection attempt: original={original_task_id}, decoded={task_id}")
    logger.info(f"Available tasks in progress_store: {list(progress_store.keys())}")

    if task_id in progress_store:
        await websocket.accept()
        active_connections[task_id] = websocket
        logger.info(f"WebSocket connected for task: {task_id}")
        try:
            # 保持连接活跃，等待客户端断开或任务完成
            while task_id in active_connections:
                # 等待客户端消息或断开连接
                try:
                    message = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                    logger.debug(f"Received message from client: {message}")
                except asyncio.TimeoutError:
                    # 超时是正常的，继续循环
                    continue
        except WebSocketDisconnect:
            logger.info("websocket disconnected: %s", task_id)
            active_connections.pop(task_id, None)
        except Exception as e:
            logger.error(f"WebSocket error for task {task_id}: {e}")
            active_connections.pop(task_id, None)
    else:
        # 对于WebSocket，我们需要先接受连接然后关闭
        await websocket.accept()
        await websocket.close(code=1008, reason="Task not found")
        logger.warning("WebSocket connection rejected: task %s not found in %s", task_id, list(progress_store.keys()))


@app.get("/api/download")
async def download(task_id: str):
    task_id = task_id.replace("|", "/")
    if not os.path.exists(pjoin(RUNS_DIR, task_id)):
        raise HTTPException(status_code=404, detail="Task not created yet")
    file_path = pjoin(RUNS_DIR, task_id, "final.pptx")
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="application/pptx",
            headers={"Content-Disposition": "attachment; filename=pptagent.pptx"},
        )
    raise HTTPException(status_code=404, detail="Task not finished yet")


@app.post("/api/feedback")
async def feedback(request: Request):
    body = await request.json()
    feedback_text = body.get("feedback")
    task_id = body.get("task_id")

    if not feedback_text or not task_id:
        raise HTTPException(status_code=400, detail="Feedback and task_id are required")

    # 创建feedback目录
    feedback_dir = pjoin(RUNS_DIR, "feedback")
    os.makedirs(feedback_dir, exist_ok=True)

    # 清理task_id中的非法字符（Windows文件名不能包含 | 等字符）
    safe_task_id = task_id.replace("|", "_").replace(":", "_").replace("/", "_").replace("\\", "_")

    # 添加时间戳和编码支持
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_task_id}_{timestamp}.txt"

    try:
        with open(pjoin(feedback_dir, filename), "w", encoding="utf-8") as f:
            f.write(f"Task ID: {task_id}\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            f.write(f"Feedback:\n{feedback_text}\n")

        logger.info(f"Feedback saved: {filename}")
        return {"message": "Feedback submitted successfully", "filename": filename}

    except Exception as e:
        logger.error(f"Failed to save feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to save feedback")


@app.get("/")
async def hello():
    return {"message": "Hello, World!"}

@app.get("/api/")
async def api_hello():
    return {"message": "Hello, World!"}


@app.get("/api/llm-logs/{task_id}")
async def get_llm_logs(task_id: str):
    """
    获取指定任务的LLM请求记录

    Args:
        task_id: 任务ID

    Returns:
        LLM请求记录列表
    """
    try:
        # 解码任务ID
        decoded_task_id = task_id.replace("|", "/")

        # 检查任务是否存在
        if not os.path.exists(pjoin(RUNS_DIR, decoded_task_id)):
            raise HTTPException(status_code=404, detail="Task not found")

        # 获取LLM记录
        logs = llm_logger.get_logs(decoded_task_id)

        return {
            "task_id": task_id,
            "logs": logs,
            "total_count": len(logs)
        }

    except Exception as e:
        logger.error(f"Failed to get LLM logs for task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve LLM logs")


@app.get("/api/llm-logs/{task_id}/summary")
async def get_llm_logs_summary(task_id: str):
    """
    获取指定任务的LLM请求记录摘要

    Args:
        task_id: 任务ID

    Returns:
        LLM请求记录摘要统计
    """
    try:
        # 解码任务ID
        decoded_task_id = task_id.replace("|", "/")

        # 检查任务是否存在
        if not os.path.exists(pjoin(RUNS_DIR, decoded_task_id)):
            raise HTTPException(status_code=404, detail="Task not found")

        # 获取LLM记录
        logs = llm_logger.get_logs(decoded_task_id)

        # 统计信息
        summary = {
            "total_requests": len(logs),
            "successful_requests": len([log for log in logs if log.get("status") == "success"]),
            "failed_requests": len([log for log in logs if log.get("status") == "error"]),
            "stages": {},
            "model_types": {},
            "total_duration_ms": 0,
            "total_tokens": 0
        }

        for log in logs:
            # 按阶段统计
            stage = log.get("stage", "unknown")
            if stage not in summary["stages"]:
                summary["stages"][stage] = 0
            summary["stages"][stage] += 1

            # 按模型类型统计
            model_type = log.get("model_type", "unknown")
            if model_type not in summary["model_types"]:
                summary["model_types"][model_type] = 0
            summary["model_types"][model_type] += 1

            # 累计耗时
            summary["total_duration_ms"] += log.get("duration_ms", 0)

            # 累计token使用
            response = log.get("response", {})
            tokens = response.get("tokens_used", 0)
            if tokens:
                summary["total_tokens"] += tokens

        return {
            "task_id": task_id,
            "summary": summary
        }

    except Exception as e:
        logger.error(f"Failed to get LLM logs summary for task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve LLM logs summary")


async def ppt_gen(task_id: str, rerun=False):
    if DEBUG:
        importlib.reload(induct)
        importlib.reload(pptgen)
    if rerun:
        task_id = task_id.replace("|", "/")
        active_connections[task_id] = None
        with open(pjoin(RUNS_DIR, task_id, "task.json"), "r", encoding="utf-8") as f:
            progress_store[task_id] = json.load(f)

    # Wait for WebSocket connection
    for _ in range(100):
        if task_id in active_connections:
            break
        await asyncio.sleep(0.02)
    else:
        progress_store.pop(task_id)
        return

    task = progress_store.pop(task_id)
    pptx_md5 = task["pptx"]
    generation_config = Config(pjoin(RUNS_DIR, task_id))
    pptx_config = Config(pjoin(RUNS_DIR, "pptx", pptx_md5))
    json.dump(task, open(pjoin(generation_config.RUN_DIR, "task.json"), "w", encoding="utf-8"), ensure_ascii=False)
    progress = ProgressManager(task_id, STAGES)

    # 检查文档源类型
    has_pdf = "pdf" in task and task["pdf"] is not None
    has_text_file = "textFile" in task and task["textFile"] is not None
    has_user_input = "userInput" in task and task["userInput"] is not None
    has_topic = "topic" in task and task["topic"] is not None

    # 确定文档源目录
    if has_pdf:
        pdf_md5 = task["pdf"]
        parsedpdf_dir = pjoin(RUNS_DIR, "pdf", pdf_md5)
    elif has_text_file:
        text_md5 = task["textFile"]
        parsedpdf_dir = pjoin(RUNS_DIR, "text", text_md5)
    elif has_user_input:
        input_md5 = task["userInput"]
        parsedpdf_dir = pjoin(RUNS_DIR, "input", input_md5)
    elif has_topic:
        # 为topic创建一个唯一的目录
        topic_hash = hashlib.md5(task["topic"].encode('utf-8')).hexdigest()
        parsedpdf_dir = pjoin(RUNS_DIR, "topic", topic_hash)
        os.makedirs(parsedpdf_dir, exist_ok=True)
    else:
        await progress.fail_stage("No document source provided (PDF, text file, user input, or topic)")
        return
    ppt_image_folder = pjoin(pptx_config.RUN_DIR, "slide_images")

    await send_progress(
        active_connections[task_id], "task initialized successfully", 10
    )

    try:
        # 设置LLM记录器上下文
        llm_logger.set_context(task_id, "ppt_parsing")

        # ppt parsing
        presentation = Presentation.from_file(
            pjoin(pptx_config.RUN_DIR, "source.pptx"), pptx_config
        )
        if not os.path.exists(ppt_image_folder) or len(
            os.listdir(ppt_image_folder)
        ) != len(presentation):
            await ppt_to_images_async(
                pjoin(pptx_config.RUN_DIR, "source.pptx"), ppt_image_folder
            )
            assert len(os.listdir(ppt_image_folder)) == len(presentation) + len(
                presentation.error_history
            ), "Number of parsed slides and images do not match"

            for err_idx, _ in presentation.error_history:
                os.remove(pjoin(ppt_image_folder, f"slide_{err_idx:04d}.jpg"))
            for i, slide in enumerate(presentation.slides, 1):
                slide.slide_idx = i
                os.rename(
                    pjoin(ppt_image_folder, f"slide_{slide.real_idx:04d}.jpg"),
                    pjoin(ppt_image_folder, f"slide_{slide.slide_idx:04d}.jpg"),
                )

        # 设置图像标注阶段上下文
        llm_logger.set_context(task_id, "image_caption")

        labler = ImageLabler(presentation, pptx_config)
        if os.path.exists(pjoin(pptx_config.RUN_DIR, "image_stats.json")):
            image_stats = json.load(
                open(pjoin(pptx_config.RUN_DIR, "image_stats.json"), encoding="utf-8")
            )
            labler.apply_stats(image_stats)
        else:
            await labler.caption_images_async(models.vision_model)
            json.dump(
                labler.image_stats,
                open(
                    pjoin(pptx_config.RUN_DIR, "image_stats.json"),
                    "w",
                    encoding="utf-8",
                ),
                ensure_ascii=False,
                indent=4,
            )
        await progress.report_progress()

        # 设置PDF解析阶段上下文
        llm_logger.set_context(task_id, "pdf_parsing")

        # 文档解析处理
        source_contents = []  # 用于存储多个内容源

        if not os.path.exists(pjoin(parsedpdf_dir, "source.md")):
            # 处理多种内容源

            # 1. 处理主题内容生成
            if has_topic and task.get("generateTopicContent", True):
                # 发送自定义进度消息
                await send_progress(
                    active_connections[task_id],
                    "正在生成主题相关内容...",
                    30
                )

                try:
                    # 创建主题内容生成agent
                    from pptagent.agent import AsyncAgent
                    topic_generator = AsyncAgent(
                        "topic_content_generator",
                        llm_mapping={"language": models.language_model}
                    )

                    # 生成详细内容
                    generated_content = await topic_generator(
                        topic=task["topic"],
                        user_context=task.get("userContext", ""),
                        target_audience=task.get("targetAudience", ""),
                        presentation_style=task.get("presentationStyle", "")
                    )

                    # 确保生成的内容是字符串
                    if isinstance(generated_content, tuple):
                        # 如果返回的是元组，取第二个元素（通常是实际内容）
                        generated_content = generated_content[1] if len(generated_content) > 1 else str(generated_content[0])
                    elif not isinstance(generated_content, str):
                        generated_content = str(generated_content)

                    source_contents.append(("主题生成内容", generated_content))

                except Exception as e:
                    logger.warning(f"主题内容生成失败，使用基础模板: {e}")
                    # 如果AI生成失败，使用基础模板
                    basic_content = f"""# {task['topic']}

## 概述
这是关于"{task['topic']}"的演示文稿内容。

## 主要内容
请根据以下要点展开：
- 背景介绍
- 核心要点
- 具体案例
- 总结展望

## 补充信息
{task.get('userContext', '暂无补充信息')}

## 目标受众
{task.get('targetAudience', '通用受众')}

## 演示风格
{task.get('presentationStyle', '标准演示')}"""

                    source_contents.append(("主题生成内容", basic_content))

            # 2. 处理文档文件
            if has_pdf:
                # 解析PDF文件
                pdf_content = parse_pdf(
                    pjoin(RUNS_DIR, "pdf", pdf_md5, "source.pdf"),
                    parsedpdf_dir,
                    models.marker_model,
                )
                source_contents.append(("PDF文档", pdf_content))
            elif has_text_file:
                # 解析文本文件
                text_md5 = task["textFile"]
                text_dir = pjoin(RUNS_DIR, "text", text_md5)

                # 查找源文件
                source_files = [f for f in os.listdir(text_dir) if f.startswith("source")]
                if not source_files:
                    await progress.fail_stage("Text source file not found")
                    return

                source_file = pjoin(text_dir, source_files[0])
                file_type = os.path.splitext(source_files[0])[1].lower()

                # 根据文件类型解析
                if file_type == '.md' or file_type == '.markdown':
                    with open(source_file, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                elif file_type == '.txt':
                    # 检测编码并读取
                    with open(source_file, 'rb') as f:
                        raw_data = f.read()
                        encoding = chardet.detect(raw_data)['encoding'] or 'utf-8'
                    with open(source_file, 'r', encoding=encoding) as f:
                        content = f.read()
                    # 简单格式化为markdown
                    file_content = f"# {task.get('textFileName', '文档')}\n\n{content}"
                elif file_type == '.docx':
                    # 解析DOCX文件
                    doc = docx.Document(source_file)
                    content_parts = [f"# {task.get('textFileName', '文档')}", ""]

                    for paragraph in doc.paragraphs:
                        text = paragraph.text.strip()
                        if text:
                            if paragraph.style.name.startswith('Heading'):
                                level = paragraph.style.name.replace('Heading ', '')
                                if level.isdigit():
                                    content_parts.append(f"{'#' * (int(level) + 1)} {text}")
                                else:
                                    content_parts.append(f"## {text}")
                            else:
                                content_parts.append(text)
                            content_parts.append("")

                    file_content = "\n".join(content_parts)
                else:
                    # 其他格式，尝试作为纯文本处理
                    with open(source_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    file_content = f"# {task.get('textFileName', '文档')}\n\n{content}"

                source_contents.append(("文本文件", file_content))

            # 3. 处理用户输入
            if has_user_input:
                # 处理用户直接输入
                input_md5 = task["userInput"]
                input_dir = pjoin(RUNS_DIR, "input", input_md5)

                with open(pjoin(input_dir, "user_input.txt"), "r", encoding="utf-8") as f:
                    user_content = f.read()

                # 格式化用户输入为markdown
                lines = user_content.strip().split('\n')
                formatted_lines = ["# 用户输入文档", ""]

                current_section = []
                for line in lines:
                    line = line.strip()
                    if not line:
                        if current_section:
                            formatted_lines.extend(current_section)
                            formatted_lines.append("")
                            current_section = []
                        continue

                    # 检测是否可能是标题
                    if (len(line) < 50 and
                        not line.endswith('.') and
                        not line.endswith(',') and
                        not line.endswith(';')):
                        if current_section:
                            formatted_lines.extend(current_section)
                            formatted_lines.append("")
                            current_section = []
                        formatted_lines.append(f"## {line}")
                        formatted_lines.append("")
                    else:
                        current_section.append(line)

                if current_section:
                    formatted_lines.extend(current_section)

                user_input_content = "\n".join(formatted_lines)
                source_contents.append(("用户输入", user_input_content))

            # 4. 合并所有内容源
            if source_contents:
                # 合并多个内容源
                merged_content_parts = [f"# {task['topic']}"]
                merged_content_parts.append("")

                for source_name, content in source_contents:
                    # 确保内容是字符串类型
                    if not isinstance(content, str):
                        logger.warning(f"Content from {source_name} is not string: {type(content)}")
                        content = str(content)

                    merged_content_parts.append(f"## {source_name}")
                    merged_content_parts.append("")
                    merged_content_parts.append(content)
                    merged_content_parts.append("")

                # 确保所有部分都是字符串
                string_parts = []
                for part in merged_content_parts:
                    if isinstance(part, str):
                        string_parts.append(part)
                    else:
                        logger.warning(f"Non-string part found: {type(part)} - {part}")
                        string_parts.append(str(part))

                text_content = "\n".join(string_parts)
            else:
                # 仅有主题，无其他内容源
                text_content = f"# {task['topic']}\n\n请基于这个主题生成演示文稿内容。"

            # 保存合并后的内容到source.md
            with open(pjoin(parsedpdf_dir, "source.md"), "w", encoding="utf-8") as f:
                f.write(text_content)
        else:
            text_content = open(
                pjoin(parsedpdf_dir, "source.md"), encoding="utf-8"
            ).read()
        await progress.report_progress()

        # 设置文档优化阶段上下文
        llm_logger.set_context(task_id, "document_refine")

        # document refine
        if not os.path.exists(pjoin(parsedpdf_dir, "refined_doc.json")):
            source_doc = await Document.from_markdown_async(
                text_content,
                models.language_model,
                models.vision_model,
                parsedpdf_dir,
            )
            json.dump(
                source_doc.to_dict(),
                open(pjoin(parsedpdf_dir, "refined_doc.json"), "w", encoding="utf-8"),
                ensure_ascii=False,
                indent=4,
            )
        else:
            try:
                with open(pjoin(parsedpdf_dir, "refined_doc.json"), "r", encoding="utf-8") as f:
                    source_doc = json.load(f)
                source_doc = Document.from_dict(source_doc, parsedpdf_dir)
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.error(f"Failed to load refined_doc.json: {e}")
                # 如果JSON文件损坏，重新生成
                logger.info("Regenerating document due to corrupted JSON file...")
                source_doc = await Document.from_markdown_async(
                    text_content,
                    models.language_model,
                    models.vision_model,
                    parsedpdf_dir,
                )
                json.dump(
                    source_doc.to_dict(),
                    open(pjoin(parsedpdf_dir, "refined_doc.json"), "w", encoding="utf-8"),
                    ensure_ascii=False,
                    indent=4,
                )
        await progress.report_progress()

        # 设置幻灯片归纳阶段上下文
        llm_logger.set_context(task_id, "slide_induction")

        # Slide Induction
        if not os.path.exists(pjoin(pptx_config.RUN_DIR, "slide_induction.json")):
            deepcopy(presentation).save(
                pjoin(pptx_config.RUN_DIR, "template.pptx"), layout_only=True
            )
            await ppt_to_images_async(
                pjoin(pptx_config.RUN_DIR, "template.pptx"),
                pjoin(pptx_config.RUN_DIR, "template_images"),
            )
            slide_inducter = induct.SlideInducterAsync(
                presentation,
                ppt_image_folder,
                pjoin(pptx_config.RUN_DIR, "template_images"),
                pptx_config,
                models.image_model,
                models.language_model,
                models.vision_model,
            )
            layout_induction = await slide_inducter.layout_induct()
            slide_induction = await slide_inducter.content_induct(layout_induction)
            json.dump(
                slide_induction,
                open(
                    pjoin(pptx_config.RUN_DIR, "slide_induction.json"),
                    "w",
                    encoding="utf-8",
                ),
                ensure_ascii=False,
                indent=4,
            )
        else:
            slide_induction = json.load(
                open(
                    pjoin(pptx_config.RUN_DIR, "slide_induction.json"), encoding="utf-8"
                )
            )
        await progress.report_progress()

        # 设置PPT生成阶段上下文
        llm_logger.set_context(task_id, "ppt_generation")

        # PPT Generation with PPTAgentAsync
        ppt_agent = pptgen.PPTAgentAsync(
            models.text_model,
            models.language_model,
            models.vision_model,
            error_exit=False,
            retry_times=5,
            sim_bound=0.2,  # 降低相似度阈值以处理章节匹配问题
        )
        ppt_agent.set_reference(
            config=generation_config,
            slide_induction=slide_induction,
            presentation=presentation,
        )

        prs, _ = await ppt_agent.generate_pres(
            source_doc=source_doc,
            num_slides=task["numberOfPages"],
        )
        prs.save(pjoin(generation_config.RUN_DIR, "final.pptx"))
        logger.info(f"{task_id}: generation finished")
        await progress.report_progress()
    except Exception as e:
        await progress.fail_stage(str(e))
        traceback.print_exc()


if __name__ == "__main__":
    import uvicorn

    async def run_server():
        """异步运行服务器"""
        config = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=9297,
            log_level="info",
            access_log=True,
            # 添加优雅关闭配置
            timeout_keep_alive=5,
            timeout_graceful_shutdown=10,
        )
        server = uvicorn.Server(config)

        # 监听关闭事件
        async def shutdown_monitor():
            await shutdown_event.wait()
            print("� 开始关闭服务器...")
            server.should_exit = True

        # 启动关闭监听器
        shutdown_task = asyncio.create_task(shutdown_monitor())

        try:
            await server.serve()
        finally:
            shutdown_task.cancel()
            try:
                await shutdown_task
            except asyncio.CancelledError:
                pass

    try:
        ip = "0.0.0.0"
        print("🚀 启动PPTAgent后端服务...")
        print(f"🌐 服务地址: http://{ip}:9297")
        print("📝 使用 Ctrl+C 停止服务")
        print("=" * 50)

        # 运行异步服务器
        asyncio.run(run_server())

    except KeyboardInterrupt:
        print("\n🛑 接收到中断信号，正在停止服务...")
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        traceback.print_exc()
    finally:
        print("👋 PPTAgent后端服务已停止")
