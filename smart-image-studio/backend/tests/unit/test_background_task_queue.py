import asyncio

import pytest

from app.infrastructure.queue.background_task_queue import BackgroundTaskQueue


async def test_enqueue_nowait_raises_queue_full_when_maxsize_reached() -> None:
    q = BackgroundTaskQueue(maxsize=1)
    q.enqueue_nowait("job-1")
    with pytest.raises(asyncio.QueueFull):
        q.enqueue_nowait("job-2")


async def test_worker_processes_all_enqueued_jobs() -> None:
    handled: list[str] = []

    async def handler(job_id: str) -> None:
        handled.append(job_id)

    q = BackgroundTaskQueue()
    q.ensure_worker(handler)
    q.enqueue_nowait("job-1")
    q.enqueue_nowait("job-2")
    await asyncio.sleep(0.05)
    assert handled == ["job-1", "job-2"]
    await q.shutdown()


async def test_unhandled_error_callback_called_when_handler_raises() -> None:
    errors: list[str] = []

    async def failing_handler(job_id: str) -> None:
        raise RuntimeError("boom")

    q = BackgroundTaskQueue(on_unhandled_error=lambda job_id: errors.append(job_id))
    q.ensure_worker(failing_handler)
    q.enqueue_nowait("bad-job")
    await asyncio.sleep(0.05)
    assert "bad-job" in errors
    await q.shutdown()


async def test_shutdown_completes_worker_task() -> None:
    async def noop(_: str) -> None:
        pass

    q = BackgroundTaskQueue()
    q.ensure_worker(noop)
    assert q._worker_task is not None
    await q.shutdown()
    assert q._worker_task.done()


async def test_ensure_worker_does_not_create_duplicate() -> None:
    async def noop(_: str) -> None:
        pass

    q = BackgroundTaskQueue()
    q.ensure_worker(noop)
    task1 = q._worker_task
    q.ensure_worker(noop)
    assert q._worker_task is task1
    await q.shutdown()


async def test_shutdown_with_no_worker_does_not_raise() -> None:
    q = BackgroundTaskQueue()
    await q.shutdown()


async def test_worker_continues_after_handler_raises() -> None:
    results: list[str] = []

    async def handler(job_id: str) -> None:
        if job_id == "bad":
            raise RuntimeError("fail")
        results.append(job_id)

    q = BackgroundTaskQueue()
    q.ensure_worker(handler)
    q.enqueue_nowait("bad")
    q.enqueue_nowait("good")
    await asyncio.sleep(0.05)
    assert "good" in results
    await q.shutdown()
