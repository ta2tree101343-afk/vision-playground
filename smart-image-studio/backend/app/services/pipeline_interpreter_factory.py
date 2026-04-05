from functools import lru_cache

from app.core.config import Settings, get_settings
from app.schemas.pipeline import PipelineInterpreterMode
from app.services.llm_interpreter import LLMInterpreter
from app.services.pipeline_interpreter import PipelineInterpreter
from app.services.rule_based_interpreter import RuleBasedInterpreter


@lru_cache
def get_pipeline_interpreter(
    mode_override: PipelineInterpreterMode | None = None,
) -> PipelineInterpreter:
    settings = get_settings()
    return build_pipeline_interpreter(settings, mode_override)


def build_pipeline_interpreter(
    settings: Settings,
    mode_override: PipelineInterpreterMode | None = None,
) -> PipelineInterpreter:
    interpreter_mode = mode_override or settings.pipeline_interpreter_mode

    if interpreter_mode == PipelineInterpreterMode.LLM:
        return LLMInterpreter(settings)

    return RuleBasedInterpreter()
