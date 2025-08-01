import base64
import json
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Union, Dict, Any, List

import torch
from oaib import Auto
from openai import AsyncOpenAI, OpenAI
from openai.types.chat import ChatCompletion

from pptagent.utils import get_json_from_response, get_logger, tenacity_decorator

logger = get_logger(__name__)


class LLMLogger:
    """
    LLM请求记录管理器
    负责记录所有LLM请求和响应的详细信息
    """

    def __init__(self):
        self.current_task_id: Optional[str] = None
        self.current_stage: Optional[str] = None
        self.current_agent_role: Optional[str] = None
        self.logs_cache: Dict[str, List[Dict[str, Any]]] = {}

    def set_context(self, task_id: str, stage: str, agent_role: str = None):
        """设置当前上下文信息"""
        self.current_task_id = task_id
        self.current_stage = stage
        self.current_agent_role = agent_role

    def log_request(
        self,
        model_type: str,
        model_name: str,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        duration_ms: float,
        status: str = "success",
        error: str = None
    ) -> str:
        """
        记录LLM请求

        Args:
            model_type: 模型类型 (language/vision/text/image)
            model_name: 具体模型名称
            request_data: 请求数据
            response_data: 响应数据
            duration_ms: 请求耗时(毫秒)
            status: 状态 (success/error)
            error: 错误信息

        Returns:
            request_id: 请求ID
        """
        request_id = str(uuid.uuid4())

        log_entry = {
            "request_id": request_id,
            "task_id": self.current_task_id,
            "timestamp": datetime.now().isoformat(),
            "stage": self.current_stage,
            "agent_role": self.current_agent_role,
            "model_type": model_type,
            "model_name": model_name,
            "request": request_data,
            "response": response_data,
            "duration_ms": duration_ms,
            "status": status,
            "error": error
        }

        # 添加到内存缓存
        if self.current_task_id:
            if self.current_task_id not in self.logs_cache:
                self.logs_cache[self.current_task_id] = []
            self.logs_cache[self.current_task_id].append(log_entry)

            # 写入文件
            self._write_to_file(log_entry)

        return request_id

    def _write_to_file(self, log_entry: Dict[str, Any]):
        """将日志写入文件"""
        if not self.current_task_id:
            return

        try:
            # 构建日志文件路径
            from pptagent.utils import package_join, pjoin
            runs_dir = package_join("runs")
            task_dir = pjoin(runs_dir, self.current_task_id)

            if os.path.exists(task_dir):
                log_file = pjoin(task_dir, "llm_logs.jsonl")
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"Failed to write LLM log to file: {e}")

    def get_logs(self, task_id: str) -> List[Dict[str, Any]]:
        """获取指定任务的所有LLM日志"""
        # 先从缓存获取
        if task_id in self.logs_cache:
            return self.logs_cache[task_id]

        # 从文件读取
        try:
            from pptagent.utils import package_join, pjoin
            runs_dir = package_join("runs")
            log_file = pjoin(runs_dir, task_id, "llm_logs.jsonl")

            if os.path.exists(log_file):
                logs = []
                with open(log_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            logs.append(json.loads(line.strip()))
                self.logs_cache[task_id] = logs
                return logs
        except Exception as e:
            logger.warning(f"Failed to read LLM logs from file: {e}")

        return []

    def clear_cache(self, task_id: str = None):
        """清理缓存"""
        if task_id:
            self.logs_cache.pop(task_id, None)
        else:
            self.logs_cache.clear()


# 全局LLM记录器实例
llm_logger = LLMLogger()


@dataclass
class LLM:
    """
    A wrapper class to interact with a language model.
    """

    model: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    timeout: int = 360

    def __post_init__(self):
        self.client = OpenAI(
            base_url=self.base_url, api_key=self.api_key, timeout=self.timeout
        )

    @tenacity_decorator
    def __call__(
        self,
        content: str,
        images: Optional[Union[str, list[str]]] = None,
        system_message: Optional[str] = None,
        history: Optional[list] = None,
        return_json: bool = False,
        return_message: bool = False,
        **client_kwargs,
    ) -> Union[str, dict, list, tuple]:
        """
        Call the language model with a prompt and optional images.

        Args:
            content (str): The prompt content.
            images (str or list[str]): An image file path or list of image file paths.
            system_message (str): The system message.
            history (list): The conversation history.
            return_json (bool): Whether to return the response as JSON.
            return_message (bool): Whether to return the message.
            **client_kwargs: Additional keyword arguments to pass to the client.

        Returns:
            Union[str, Dict, List, Tuple]: The response from the model.
        """
        # 记录请求开始时间
        start_time = time.time()

        if history is None:
            history = []
        system, message = self.format_message(content, images, system_message)

        # 准备请求数据用于记录
        request_data = {
            "content": content,
            "system_message": system_message,
            "images": images if isinstance(images, list) else ([images] if images else []),
            "history": history,
            "parameters": client_kwargs
        }

        try:
            completion = self.client.chat.completions.create(
                model=self.model, messages=system + history + message, **client_kwargs
            )

            # 计算耗时
            duration_ms = (time.time() - start_time) * 1000

            response = completion.choices[0].message.content
            message.append({"role": "assistant", "content": response})

            # 准备响应数据用于记录
            response_data = {
                "content": response,
                "tokens_used": getattr(completion.usage, 'total_tokens', None) if hasattr(completion, 'usage') else None,
                "model": completion.model if hasattr(completion, 'model') else self.model
            }

            # 记录成功的请求
            llm_logger.log_request(
                model_type=self._get_model_type(),
                model_name=self.model,
                request_data=request_data,
                response_data=response_data,
                duration_ms=duration_ms,
                status="success"
            )

            return self.__post_process__(response, message, return_json, return_message)

        except Exception as e:
            # 计算耗时
            duration_ms = (time.time() - start_time) * 1000

            # 记录失败的请求
            llm_logger.log_request(
                model_type=self._get_model_type(),
                model_name=self.model,
                request_data=request_data,
                response_data={"error": str(e)},
                duration_ms=duration_ms,
                status="error",
                error=str(e)
            )

            logger.warning("Error in LLM call: %s", e)
            raise e

    def _get_model_type(self) -> str:
        """根据模型名称推断模型类型"""
        model_lower = self.model.lower()
        if any(keyword in model_lower for keyword in ['vision', 'gpt-4o', 'gpt-4-vision', 'claude-3']):
            return "vision"
        elif any(keyword in model_lower for keyword in ['dall-e', 'midjourney', 'stable-diffusion']):
            return "image"
        elif any(keyword in model_lower for keyword in ['embedding', 'text-embedding']):
            return "text"
        else:
            return "language"

    def __post_process__(
        self,
        response: str,
        message: list,
        return_json: bool = False,
        return_message: bool = False,
    ) -> Union[str, dict, tuple]:
        """
        Process the response based on return options.

        Args:
            response (str): The raw response from the model.
            message (List): The message history.
            return_json (bool): Whether to return the response as JSON.
            return_message (bool): Whether to return the message.

        Returns:
            Union[str, Dict, Tuple]: Processed response.
        """
        response = response.strip()
        if return_json:
            response = get_json_from_response(response)
        if return_message:
            response = (response, message)
        return response

    def __repr__(self) -> str:
        repr_str = f"{self.__class__.__name__}(model={self.model}"
        if self.base_url is not None:
            repr_str += f", base_url={self.base_url}"
        return repr_str + ")"

    def test_connection(self) -> bool:
        """
        Test the connection to the LLM.

        Returns:
            bool: True if connection is successful, False otherwise.
        """
        try:
            self.client.models.list()
            return True
        except Exception as e:
            logger.warning(
                "Connection test failed: %s\nLLM: %s: %s, %s",
                e,
                self.model,
                self.base_url,
                self.api_key,
            )
            return False

    def format_message(
        self,
        content: str,
        images: Optional[Union[str, list[str]]] = None,
        system_message: Optional[str] = None,
    ) -> tuple[list, list]:
        """
        Format messages for OpenAI server call.

        Args:
            content (str): The prompt content.
            images (str or list[str]): An image file path or list of image file paths.
            system_message (str): The system message.

        Returns:
            Tuple[List, List]: Formatted system and user messages.
        """
        if isinstance(images, str):
            images = [images]
        if system_message is None:
            if content.startswith("You are"):
                system_message, content = content.split("\n", 1)
            else:
                system_message = "You are a helpful assistant"
        system = [
            {
                "role": "system",
                "content": [{"type": "text", "text": system_message}],
            }
        ]
        message = [{"role": "user", "content": [{"type": "text", "text": content}]}]
        if images is not None:
            for image in images:
                try:
                    with open(image, "rb") as f:
                        message[0]["content"].append(
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64.b64encode(f.read()).decode('utf-8')}"
                                },
                            }
                        )
                except Exception as e:
                    logger.error("Failed to load image %s: %s", image, e)
        return system, message

    def gen_image(self, prompt: str, n: int = 1, **kwargs) -> str:
        """
        Generate an image from a prompt.
        """
        return (
            self.client.images.generate(model=self.model, prompt=prompt, n=n, **kwargs)
            .data[0]
            .b64_json
        )

    def get_embedding(
        self,
        text: str,
        encoding_format: str = "float",
        to_tensor: bool = True,
        **kwargs,
    ) -> torch.Tensor | list[float]:
        """
        Get the embedding of a text.
        """
        result = self.client.embeddings.create(
            model=self.model, input=text, encoding_format=encoding_format, **kwargs
        )
        embeddings = [embedding.embedding for embedding in result.data]
        if to_tensor:
            embeddings = torch.tensor(embeddings)
        return embeddings

    def to_async(self) -> "AsyncLLM":
        """
        Convert the LLM to an asynchronous LLM.
        """
        return AsyncLLM(
            model=self.model,
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self.timeout,
        )


@dataclass
class AsyncLLM(LLM):
    use_batch: bool = False
    """
    Asynchronous wrapper class for language model interaction.
    """

    def __post_init__(self):
        """
        Initialize the AsyncLLM.

        Args:
            model (str): The model name.
            base_url (str): The base URL for the API.
            api_key (str): API key for authentication. Defaults to environment variable.
        """
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self.timeout,
        )
        try:
            self.batch = Auto(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                loglevel=0,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize batch client: {e}")
            self.batch = None

    @tenacity_decorator
    async def __call__(
        self,
        content: str,
        images: Optional[Union[str, list[str]]] = None,
        system_message: Optional[str] = None,
        history: Optional[list] = None,
        return_json: bool = False,
        return_message: bool = False,
        **client_kwargs,
    ) -> Union[str, dict, tuple]:
        """
        Asynchronously call the language model with a prompt and optional images.

        Args:
            content (str): The prompt content.
            images (str or list[str]): An image file path or list of image file paths.
            system_message (str): The system message.
            history (list): The conversation history.
            return_json (bool): Whether to return the response as JSON.
            return_message (bool): Whether to return the message.
            **client_kwargs: Additional keyword arguments to pass to the client.

        Returns:
            Union[str, Dict, List, Tuple]: The response from the model.
        """
        if self.use_batch and threading.current_thread() is threading.main_thread():
            try:
                self.batch = Auto(
                    base_url=self.base_url,
                    api_key=self.api_key,
                    timeout=self.timeout,
                    loglevel=0,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize batch client: {e}")
                self.batch = None
        elif self.use_batch:
            logger.warning(
                "Warning: AsyncLLM is not running in the main thread, may cause race condition."
            )
        # 记录请求开始时间
        start_time = time.time()

        if history is None:
            history = []
        system, message = self.format_message(content, images, system_message)

        # 准备请求数据用于记录
        request_data = {
            "content": content,
            "system_message": system_message,
            "images": images if isinstance(images, list) else ([images] if images else []),
            "history": history,
            "parameters": client_kwargs
        }

        try:
            if self.use_batch:
                await self.batch.add(
                    "chat.completions.create",
                    model=self.model,
                    messages=system + history + message,
                    **client_kwargs,
                )
                completion = await self.batch.run()
                if "result" not in completion or len(completion["result"]) != 1:
                    raise ValueError(
                        f"The length of completion result should be 1, but got {completion}.\nRace condition may have occurred if multiple values are returned.\nOr, there was an error in the LLM call, use the synchronous version to check."
                    )
                completion = ChatCompletion(**completion["result"][0])
            else:
                completion = await self.client.chat.completions.create(
                    model=self.model,
                    messages=system + history + message,
                    **client_kwargs,
                )

            # 计算耗时
            duration_ms = (time.time() - start_time) * 1000

            response = completion.choices[0].message.content
            message.append({"role": "assistant", "content": response})

            # 准备响应数据用于记录
            response_data = {
                "content": response,
                "tokens_used": getattr(completion.usage, 'total_tokens', None) if hasattr(completion, 'usage') else None,
                "model": completion.model if hasattr(completion, 'model') else self.model
            }

            # 记录成功的请求
            llm_logger.log_request(
                model_type=self._get_model_type(),
                model_name=self.model,
                request_data=request_data,
                response_data=response_data,
                duration_ms=duration_ms,
                status="success"
            )

            return self.__post_process__(response, message, return_json, return_message)

        except Exception as e:
            # 计算耗时
            duration_ms = (time.time() - start_time) * 1000

            # 记录失败的请求
            llm_logger.log_request(
                model_type=self._get_model_type(),
                model_name=self.model,
                request_data=request_data,
                response_data={"error": str(e)},
                duration_ms=duration_ms,
                status="error",
                error=str(e)
            )

            logger.warning("Error in AsyncLLM call: %s", e)
            raise e

    def __getstate__(self):
        state = self.__dict__.copy()
        state["client"] = None
        state["batch"] = None
        return state

    def __setstate__(self, state: dict):
        self.__dict__.update(state)
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self.timeout,
        )
        try:
            self.batch = Auto(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                loglevel=0,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize batch client: {e}")
            self.batch = None

    async def cleanup(self):
        """
        清理资源，特别是 batch 客户端
        """
        try:
            if hasattr(self, 'batch') and self.batch is not None:
                # 尝试优雅关闭 batch 客户端
                if hasattr(self.batch, 'stop'):
                    await self.batch.stop()
                elif hasattr(self.batch, 'close'):
                    await self.batch.close()
                self.batch = None
        except Exception as e:
            logger.debug(f"清理 batch 客户端时出错: {e}")

        try:
            if hasattr(self, 'client') and self.client is not None:
                # 关闭 OpenAI 客户端
                if hasattr(self.client, 'close'):
                    await self.client.close()
        except Exception as e:
            logger.debug(f"清理 OpenAI 客户端时出错: {e}")

    async def test_connection(self) -> bool:
        """
        Test the connection to the LLM asynchronously.

        Returns:
            bool: True if connection is successful, False otherwise.
        """
        try:
            await self.client.models.list()
            return True
        except Exception as e:
            logger.warning(
                "Async connection test failed: %s\nLLM: %s: %s, %s",
                e,
                self.model,
                self.base_url,
                self.api_key,
            )
            return False

    async def gen_image(self, prompt: str, n: int = 1, **kwargs) -> str:
        """
        Generate an image from a prompt asynchronously.

        Args:
            prompt (str): The text prompt to generate an image from.
            n (int): Number of images to generate.
            **kwargs: Additional keyword arguments for image generation.

        Returns:
            str: Base64-encoded image data.
        """
        response = await self.client.images.generate(
            model=self.model, prompt=prompt, n=n, response_format="b64_json", **kwargs
        )
        return response.data[0].b64_json

    async def get_embedding(
        self,
        text: str,
        to_tensor: bool = True,
        **kwargs,
    ) -> torch.Tensor | list[float]:
        """
        Get the embedding of a text asynchronously.

        Args:
            text (str): The text to get embeddings for.
            **kwargs: Additional keyword arguments.

        Returns:
            List[float]: The embedding vector.
        """
        response = await self.client.embeddings.create(
            model=self.model,
            input=text,
            encoding_format="float",
            **kwargs,
        )
        embeddings = [embedding.embedding for embedding in response.data]
        if to_tensor:
            embeddings = torch.tensor(embeddings)
        return embeddings

    def to_sync(self) -> LLM:
        """
        Convert the AsyncLLM to a synchronous LLM.
        """
        return LLM(model=self.model, base_url=self.base_url, api_key=self.api_key)


def get_model_abbr(llms: Union[LLM, list[LLM]]) -> str:
    """
    Get abbreviated model names from LLM instances.

    Args:
        llms: A single LLM instance or a list of LLM instances.

    Returns:
        str: Abbreviated model names joined with '+'.
    """
    # Convert single LLM to list for consistent handling
    if isinstance(llms, LLM):
        llms = [llms]

    try:
        # Attempt to extract model names before version numbers
        return "+".join(re.search(r"^(.*?)-\d{2}", llm.model).group(1) for llm in llms)
    except Exception:
        # Fallback: return full model names if pattern matching fails
        return "+".join(llm.model for llm in llms)
