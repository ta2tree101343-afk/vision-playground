class ImageProcessingError(Exception):
    pass


class JobNotFoundError(Exception):
    def __init__(self, job_id: str) -> None:
        self.job_id = job_id
        super().__init__(f"Job not found: {job_id}")


class StorageError(OSError):
    pass


class MaskSaveError(StorageError):
    pass


class JobQueueFullError(Exception):
    pass
