from abc import ABC, abstractmethod

from app.schemas.pipeline import PipelinePlan


class PipelineInterpretationError(Exception):
    pass


class PipelineInterpreter(ABC):
    @abstractmethod
    def interpret(self, instruction: str) -> PipelinePlan:
        raise NotImplementedError
