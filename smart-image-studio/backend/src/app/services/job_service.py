from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import TYPE_CHECKING

from app.core.constants import JOB_HISTORY_LIMIT, JOB_QUEUE_MAXSIZE
from app.core.exceptions import ImageProcessingError, JobNotFoundError, JobQueueFullError, MaskSaveError, ModelNotAvailableError
from app.infrastructure.queue.background_task_queue import BackgroundTaskQueue
from app.schemas.image import ImageOperationStep
from app.schemas.job import ImageProcessJob, JobStatus
from app.services.image_processor import ImageProcessingResult, ImageProcessor
from app.services.storage_service import StorageService, save_and_build_response
from app.utils.datetime_util import utc_now
from app.utils.id_util import generate_id

if TYPE_CHECKING:
    from app.repositories.job_repository import JobRepository

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _EnqueuedPayload:
    source_path: Path
    public_path: str
    filename: str
    base_url: str


class JobService:
    def __init__(
        self,
        image_processor: ImageProcessor,
        storage_service: StorageService,
        job_repository: JobRepository,
    ) -> None:
        self._image_processor = image_processor
        self._storage_service = storage_service
        self._repository = job_repository
        # _payloads/_queue_order are in-process memory: queue state is lost on restart.
        # mark_interrupted_jobs() handles recovery. Multi-worker support requires a durable queue.
        self._payloads: dict[str, _EnqueuedPayload] = {}
        self._operations: dict[str, list[ImageOperationStep]] = {}
        self._queue_order: list[str] = []
        self._lock = RLock()
        self._task_queue = BackgroundTaskQueue(
            maxsize=JOB_QUEUE_MAXSIZE,
            on_unhandled_error=lambda job_id: self._mark_failed(job_id, "予期しないエラーでジョブが失敗しました。"),
        )

    async def enqueue_job(
        self,
        *,
        image_bytes: bytes,
        filename: str,
        base_url: str,
        operations: list[ImageOperationStep],
    ) -> ImageProcessJob:
        self._task_queue.ensure_worker(self._process_job)
        job_id = generate_id()

        original_file = self._storage_service.save_original(image_bytes, filename)
        payload = _EnqueuedPayload(
            source_path=original_file.file_path,
            public_path=original_file.public_path,
            filename=filename,
            base_url=base_url,
        )

        job = ImageProcessJob(
            job_id=job_id,
            status=JobStatus.QUEUED,
            progress=0,
            message="ジョブをキューに追加しました。",
            filename=filename,
            created_at=utc_now(),
            applied_operations=operations,
        )
        await asyncio.to_thread(self._register_job, job, payload, operations)

        try:
            self._task_queue.enqueue_nowait(job_id)
        except asyncio.QueueFull:
            await asyncio.to_thread(self._cancel_job, job_id)
            raise JobQueueFullError("ジョブキューが満杯です。しばらく後に再試行してください。")

        return await asyncio.to_thread(self.get_job, job_id)

    def list_jobs(self) -> list[ImageProcessJob]:
        with self._lock:
            jobs = self._repository.list_recent(JOB_HISTORY_LIMIT)
            return [self._with_queue_position(job) for job in jobs]

    def get_job(self, job_id: str) -> ImageProcessJob:
        with self._lock:
            job = self._repository.find(job_id)
            if job is None:
                raise JobNotFoundError(job_id)
            return self._with_queue_position(job)

    async def shutdown(self) -> None:
        await self._task_queue.shutdown()

    async def _process_job(self, job_id: str) -> None:
        with self._lock:
            payload = self._payloads.get(job_id)
            operations = self._operations.get(job_id, [])
            self._queue_order = [j for j in self._queue_order if j != job_id]
        if payload is None:
            logger.error("ジョブ %s のペイロードが見つかりません", job_id)
            await asyncio.to_thread(self._mark_failed, job_id, "内部エラー: ジョブペイロードが見つかりません。")
            return

        await asyncio.to_thread(
            self._repository.update,
            job_id,
            status=JobStatus.RUNNING,
            progress=5,
            message="ジョブを開始しました。",
            started_at=utc_now(),
        )

        try:
            image_bytes = payload.source_path.read_bytes()

            def progress_callback(progress: int, message: str) -> None:
                self._repository.update(job_id, progress=progress, message=message)

            processing_result: ImageProcessingResult = await asyncio.to_thread(
                self._image_processor.process,
                image_bytes,
                operations,
                progress_callback=progress_callback,
            )
            await asyncio.to_thread(
                self._repository.update,
                job_id,
                progress=92,
                message="加工後画像を保存しています。",
            )
            result = save_and_build_response(
                self._storage_service,
                processed_image=processing_result.image,
                analysis=processing_result.analysis,
                background_mask=processing_result.background_mask,
                filename=payload.filename,
                base_url=payload.base_url,
                original_public_path=payload.public_path,
                operations=operations,
            )
            await asyncio.to_thread(
                self._repository.update,
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                message="ジョブが完了しました。",
                completed_at=utc_now(),
                result=result,
                error_message=None,
            )
        except ModelNotAvailableError:
            await asyncio.to_thread(self._mark_failed, job_id, "物体検出モデルが配置されていません。")
        except ImageProcessingError as exc:
            logger.exception("ジョブ %s: 画像処理に失敗しました: %s", job_id, exc)
            await asyncio.to_thread(self._mark_failed, job_id, "画像処理に失敗しました。")
        except MaskSaveError as exc:
            logger.exception("ジョブ %s: 背景マスクの保存に失敗しました: %s", job_id, exc)
            msg = f"背景マスクの保存に失敗しました: {exc}"
            await asyncio.to_thread(self._mark_failed, job_id, msg)
        except OSError as exc:
            logger.exception("ジョブ %s: ファイル保存に失敗しました: %s", job_id, exc)
            await asyncio.to_thread(self._mark_failed, job_id, "画像ファイルの保存に失敗しました。")
        except (MemoryError, SystemExit, KeyboardInterrupt):
            raise
        except Exception:
            logger.exception("ジョブ %s で予期しないエラーが発生しました", job_id)
            await asyncio.to_thread(self._mark_failed, job_id, "予期しないエラーでジョブが失敗しました。")
        finally:
            with self._lock:
                self._payloads.pop(job_id, None)
                self._operations.pop(job_id, None)

    def _mark_failed(self, job_id: str, message: str) -> None:
        failure_time = utc_now()
        try:
            self._repository.update(
                job_id,
                status=JobStatus.FAILED,
                message="ジョブが失敗しました。",
                started_at=failure_time,
                completed_at=failure_time,
                error_message=message,
            )
        except Exception:
            logger.exception("_mark_failed: DB 更新に失敗しました (job_id=%s)", job_id)

    def _register_job(self, job: ImageProcessJob, payload: _EnqueuedPayload, operations: list[ImageOperationStep]) -> None:
        with self._lock:
            self._repository.save(job)
            self._payloads[job.job_id] = payload
            self._operations[job.job_id] = operations
            self._queue_order.append(job.job_id)

    def _cancel_job(self, job_id: str) -> None:
        with self._lock:
            self._repository.remove(job_id)
            payload = self._payloads.pop(job_id, None)
            self._operations.pop(job_id, None)
            self._queue_order = [j for j in self._queue_order if j != job_id]
        if payload is not None:
            try:
                payload.source_path.unlink(missing_ok=True)
            except OSError as exc:
                logger.warning("_cancel_job: 元画像ファイルの削除に失敗しました (job_id=%s): %s", job_id, exc)

    def _with_queue_position(self, job: ImageProcessJob) -> ImageProcessJob:
        if job.status != JobStatus.QUEUED:
            return job
        try:
            position = self._queue_order.index(job.job_id) + 1
        except ValueError:
            position = None
        return job.model_copy(update={"queue_position": position})
