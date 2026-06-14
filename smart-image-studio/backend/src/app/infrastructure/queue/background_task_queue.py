import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)


class BackgroundTaskQueue:
    def __init__(self, maxsize: int = 0, on_unhandled_error: Callable[[str], None] | None = None) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue(maxsize=maxsize)
        self._worker_task: asyncio.Task[None] | None = None
        self._on_unhandled_error = on_unhandled_error

    @property
    def full(self) -> bool:
        return self._queue.full()

    def ensure_worker(self, handler: Callable[[str], Awaitable[None]]) -> None:
        if self._worker_task and not self._worker_task.done():
            return
        loop = asyncio.get_running_loop()
        self._worker_task = loop.create_task(self._worker_loop(handler))

    def enqueue_nowait(self, job_id: str) -> None:
        """キューに即時追加する。満杯の場合は asyncio.QueueFull を送出する。"""
        self._queue.put_nowait(job_id)

    async def enqueue(self, job_id: str) -> None:
        await self._queue.put(job_id)

    async def shutdown(self) -> None:
        if self._worker_task is None:
            return
        self._worker_task.cancel()
        try:
            await self._worker_task
        except asyncio.CancelledError:
            pass

    async def _worker_loop(self, handler: Callable[[str], Awaitable[None]]) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                await handler(job_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("[BackgroundTaskQueue] ハンドラ外で予期しない例外が発生しました (job_id=%s)", job_id)
                if self._on_unhandled_error is not None:
                    try:
                        self._on_unhandled_error(job_id)
                    except Exception:
                        logger.exception("[BackgroundTaskQueue] フォールバック失敗マーキングも失敗しました (job_id=%s)", job_id)
            finally:
                self._queue.task_done()
