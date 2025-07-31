import asyncio
import hashlib
import importlib
import json
import os
import sys
import traceback
import uuid
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
    topic: str = Form(None),
    numberOfPages: int = Form(...),
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
    if topic is not None:
        task["pdf"] = topic
    progress_store[task_id] = task
    # Start the PPT generation task asynchronously
    asyncio.create_task(ppt_gen(task_id))
    return {"task_id": task_id.replace("/", "|")}


async def send_progress(websocket: Optional[WebSocket], status: str, progress: int):
    if websocket is None:
        logger.info(f"websocket is None, status: {status}, progress: {progress}")
        return
    await websocket.send_json({"progress": progress, "status": status})


@app.websocket("/wsapi/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    task_id = task_id.replace("|", "/")
    if task_id in progress_store:
        await websocket.accept()
    else:
        raise HTTPException(status_code=404, detail="Task not found")
    active_connections[task_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("websocket disconnected: %s", task_id)
        active_connections.pop(task_id, None)


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
    pdf_md5 = task["pdf"]
    generation_config = Config(pjoin(RUNS_DIR, task_id))
    pptx_config = Config(pjoin(RUNS_DIR, "pptx", pptx_md5))
    json.dump(task, open(pjoin(generation_config.RUN_DIR, "task.json"), "w", encoding="utf-8"), ensure_ascii=False)
    progress = ProgressManager(task_id, STAGES)
    parsedpdf_dir = pjoin(RUNS_DIR, "pdf", pdf_md5)
    ppt_image_folder = pjoin(pptx_config.RUN_DIR, "slide_images")

    await send_progress(
        active_connections[task_id], "task initialized successfully", 10
    )

    try:
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

        # pdf parsing
        if not os.path.exists(pjoin(parsedpdf_dir, "source.md")):
            text_content = parse_pdf(
                pjoin(RUNS_DIR, "pdf", pdf_md5, "source.pdf"),
                parsedpdf_dir,
                models.marker_model,
            )
        else:
            text_content = open(
                pjoin(parsedpdf_dir, "source.md"), encoding="utf-8"
            ).read()
        await progress.report_progress()

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

        # PPT Generation with PPTAgentAsync
        ppt_agent = pptgen.PPTAgentAsync(
            models.text_model,
            models.language_model,
            models.vision_model,
            error_exit=False,
            retry_times=5,
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

    ip = "0.0.0.0"
    uvicorn.run(app, host=ip, port=9297)
