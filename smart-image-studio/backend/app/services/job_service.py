import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4

from fastapi import HTTPException, status
from pydantic import TypeAdapter, ValidationError

from app.schemas.image import (
    ImageAnalysisResult,
    ImageOperationStep,
    ImageProcessJob,
    JobStatus,
    ProcessImageResponse,
)
from app.services.image_processor import ImageProcessingError, ImageProcessor
from app.services.storage_service import LocalImageStorage

job_history_adapter = TypeAdapter(list[ImageProcessJob])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_asset_url(base_url: str, public_path: str) -> str:
    return f"{base_url.rstrip('/')}{public_path}"


@dataclass(frozen=True)
class PendingJobPayload:
    image_bytes: bytes
    filename: str
    base_url: str


class ImageJobService:
    def __init__(
        self,
        image_processor: ImageProcessor,
        storage_service: LocalImageStorage,
        history_path: Path,
    ) -> None:
        self._image_processor = image_processor
        self._storage_service = storage_service
        self._history_path = history_path
        self._history_path.parent.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, ImageProcessJob] = {}
        self._payloads: dict[str, PendingJobPayload] = {}
        self._operations: dict[str, list[ImageOperationStep]] = {}
        self._queue_order: list[str] = []
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker_task: asyncio.Task[None] | None = None
        self._lock = RLock()
        self._history_limit = 100
        self._load_history()

    async def enqueue_job(
        self,
        *,
        image_bytes: bytes,
        filename: str,
        base_url: str,
        operations: list[ImageOperationStep],
    ) -> ImageProcessJob:
        self._ensure_worker()

        job_id = uuid4().hex
        job = ImageProcessJob(
            job_id=job_id,
            status=JobStatus.QUEUED,
            progress=0,
            message="ジョブをキューに追加しました。",
            filename=filename,
            created_at=utc_now(),
            applied_operations=operations,
        )

        with self._lock:
            self._jobs[job_id] = job
            self._payloads[job_id] = PendingJobPayload(
                image_bytes=image_bytes,
                filename=filename,
                base_url=base_url,
            )
            self._operations[job_id] = operations
            self._queue_order.append(job_id)
            self._persist_history()

        await self._queue.put(job_id)
        return self.get_job(job_id)

    def list_jobs(self) -> list[ImageProcessJob]:
        with self._lock:
            jobs = sorted(
                self._jobs.values(),
                key=lambda job: job.created_at,
                reverse=True,
            )[: self._history_limit]
            return [self._with_queue_position(job) for job in jobs]

    def get_job(self, job_id: str) -> ImageProcessJob:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="指定されたジョブが見つかりません。",
                )
            return self._with_queue_position(job)

    async def shutdown(self) -> None:
        if self._worker_task is None:
            return

        self._worker_task.cancel()

        try:
            await self._worker_task
        except asyncio.CancelledError:
            pass

    def _ensure_worker(self) -> None:
        if self._worker_task and not self._worker_task.done():
            return

        loop = asyncio.get_running_loop()
        self._worker_task = loop.create_task(self._worker_loop())

    async def _worker_loop(self) -> None:
        while True:
            job_id = await self._queue.get()

            try:
                await self._process_job(job_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                self._mark_failed(job_id, "予期しないエラーでジョブが失敗しました。")
            finally:
                self._queue.task_done()

    async def _process_job(self, job_id: str) -> None:
        with self._lock:
            payload = self._payloads.get(job_id)
            operations = self._operations.get(job_id, [])
            self._queue_order = [queued_job_id for queued_job_id in self._queue_order if queued_job_id != job_id]

        if payload is None:
            return

        self._update_job(
            job_id,
            status=JobStatus.RUNNING,
            progress=5,
            message="ジョブを開始しました。",
            started_at=utc_now(),
        )

        try:
            self._update_job(job_id, progress=12, message="元画像を保存しています。")
            original_file = self._storage_service.save_original(payload.image_bytes, payload.filename)

            def progress_callback(progress: int, message: str) -> None:
                self._update_job(job_id, progress=progress, message=message)

            processing_result = self._image_processor.process(
                payload.image_bytes,
                operations,
                progress_callback=progress_callback,
            )

            self._update_job(job_id, progress=92, message="加工後画像を保存しています。")
            processed_file = self._storage_service.save_processed(
                processing_result.image,
                payload.filename,
            )
            analysis = (
                processing_result.analysis
                if isinstance(processing_result.analysis, ImageAnalysisResult)
                else None
            )
            if (
                analysis is not None
                and analysis.background_removal is not None
                and processing_result.background_mask is not None
            ):
                mask_file = self._storage_service.save_background_mask(
                    processing_result.background_mask,
                    payload.filename,
                )
                analysis = analysis.model_copy(
                    update={
                        "background_removal": analysis.background_removal.model_copy(
                            update={
                                "mask_image_url": build_asset_url(
                                    payload.base_url,
                                    mask_file.public_path,
                                ),
                            }
                        )
                    }
                )

            result = ProcessImageResponse(
                message="画像処理が完了しました。",
                original_image_url=build_asset_url(payload.base_url, original_file.public_path),
                processed_image_url=build_asset_url(payload.base_url, processed_file.public_path),
                processed_filename=processed_file.filename,
                applied_operations=operations,
                analysis=analysis,
            )

            self._update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                message="ジョブが完了しました。",
                completed_at=utc_now(),
                result=result,
                error_message=None,
            )
        except ImageProcessingError as exc:
            self._mark_failed(job_id, f"画像処理に失敗しました: {exc}")
        except OSError:
            self._mark_failed(job_id, "画像ファイルの保存に失敗しました。")
        except Exception:
            self._mark_failed(job_id, "予期しないエラーでジョブが失敗しました。")
        finally:
            with self._lock:
                self._payloads.pop(job_id, None)
                self._operations.pop(job_id, None)

    def _mark_failed(self, job_id: str, message: str) -> None:
        self._update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=100,
            message="ジョブが失敗しました。",
            completed_at=utc_now(),
            error_message=message,
        )

    def _update_job(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        message: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        result: ProcessImageResponse | None = None,
        error_message: str | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return

            updates: dict[str, object] = {}

            if status is not None:
                updates["status"] = status
            if progress is not None:
                updates["progress"] = progress
            if message is not None:
                updates["message"] = message
            if started_at is not None:
                updates["started_at"] = started_at
            if completed_at is not None:
                updates["completed_at"] = completed_at
            if result is not None:
                updates["result"] = result
            if error_message is not None or status == JobStatus.COMPLETED:
                updates["error_message"] = error_message

            updated_job = job.model_copy(update=updates)
            self._jobs[job_id] = updated_job
            self._persist_history()

    def _with_queue_position(self, job: ImageProcessJob) -> ImageProcessJob:
        queue_position = None

        if job.status == JobStatus.QUEUED:
            try:
                queue_position = self._queue_order.index(job.job_id) + 1
            except ValueError:
                queue_position = None

        return job.model_copy(update={"queue_position": queue_position})

    def _persist_history(self) -> None:
        jobs = sorted(self._jobs.values(), key=lambda job: job.created_at, reverse=True)[: self._history_limit]
        payload = job_history_adapter.dump_python(jobs, mode="json")
        self._history_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _load_history(self) -> None:
        if not self._history_path.exists():
            return

        try:
            raw_value = self._history_path.read_text(encoding="utf-8")
            if raw_value.strip() == "":
                return
            loaded_jobs = job_history_adapter.validate_json(raw_value)
        except (OSError, ValidationError, json.JSONDecodeError):
            return

        interrupted_at = utc_now()

        for loaded_job in loaded_jobs:
            if loaded_job.status in {JobStatus.QUEUED, JobStatus.RUNNING}:
                loaded_job = loaded_job.model_copy(
                    update={
                        "status": JobStatus.FAILED,
                        "completed_at": interrupted_at,
                        "message": "サーバー再起動によりジョブが中断しました。",
                        "error_message": "サーバー再起動によりジョブが中断しました。",
                        "queue_position": None,
                    }
                )

            self._jobs[loaded_job.job_id] = loaded_job
