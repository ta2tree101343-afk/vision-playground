import json
from urllib import error, request

from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.pipeline import (
    PipelineInterpretRequest,
    PipelineInterpreterMode,
    PipelinePlan,
)
from app.services.pipeline_interpreter import PipelineInterpretationError, PipelineInterpreter


class LLMInterpreter(PipelineInterpreter):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def interpret(self, instruction: str) -> PipelinePlan:
        if not self._settings.llm_api_key or not self._settings.llm_model:
            raise PipelineInterpretationError(
                "LLM インタープリタを使うには API キーとモデル名の設定が必要です。"
            )

        payload = self._build_request_payload(instruction)
        raw_response = self._post_to_llm(payload)
        parsed_content = self._extract_message_content(raw_response)
        normalized_json = self._extract_json_block(parsed_content)

        try:
            plan = PipelinePlan.model_validate_json(normalized_json)
        except ValidationError as exc:
            raise PipelineInterpretationError(
                f"LLM の出力を PipelinePlan として検証できませんでした: {exc}"
            ) from exc

        return plan.model_copy(update={"interpreter": PipelineInterpreterMode.LLM})

    def _build_request_payload(self, instruction: str) -> bytes:
        system_prompt = (
            "You convert Japanese image-editing instructions into a strict PipelinePlan JSON.\n"
            "Only output JSON.\n"
            "Allowed operations: grayscale, blur, sharpen, denoise, edge_detection, contrast, "
            "background_removal, object_detection, caption_generation, brightness.\n"
            "Do not include operations outside this list.\n"
            "If uncertain, return fewer steps and include notes.\n"
            "Use this schema:\n"
            "{"
            '"source_instruction": string,'
            '"interpreter": "llm",'
            '"summary": string,'
            '"confidence": "high" | "medium" | "low",'
            '"notes": string[],'
            '"steps": [{"operation": string, "parameters": object}]"'
            "}\n"
            "Parameters keys allowed: blur_strength, brightness, contrast, sharpen_strength, denoise_strength, detection_threshold.\n"
            "Use null or omit unsupported parameters."
        )
        user_prompt = PipelineInterpretRequest(instruction=instruction).instruction
        request_payload = {
            "model": self._settings.llm_model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        return json.dumps(request_payload).encode("utf-8")

    def _post_to_llm(self, payload: bytes) -> dict:
        endpoint = f"{self._settings.llm_api_base_url.rstrip('/')}/chat/completions"
        http_request = request.Request(
            endpoint,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._settings.llm_api_key}",
            },
        )

        try:
            with request.urlopen(http_request, timeout=self._settings.llm_timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise PipelineInterpretationError(
                f"LLM API がエラーを返しました: HTTP {exc.code} {detail}"
            ) from exc
        except error.URLError as exc:
            raise PipelineInterpretationError(
                "LLM API に接続できませんでした。URL とネットワーク設定を確認してください。"
            ) from exc
        except json.JSONDecodeError as exc:
            raise PipelineInterpretationError("LLM API のレスポンス JSON を解析できませんでした。") from exc

    @staticmethod
    def _extract_message_content(payload: dict) -> str:
        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise PipelineInterpretationError("LLM API のレスポンス形式が不正です。") from exc

        if not isinstance(content, str) or content.strip() == "":
            raise PipelineInterpretationError("LLM の応答本文が空です。")

        return content

    @staticmethod
    def _extract_json_block(content: str) -> str:
        stripped = content.strip()
        if stripped.startswith("```"):
            parts = stripped.split("```")
            for part in parts:
                cleaned = part.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
                if cleaned.startswith("{") and cleaned.endswith("}"):
                    return cleaned
        if stripped.startswith("{") and stripped.endswith("}"):
            return stripped

        raise PipelineInterpretationError("LLM の出力から JSON を抽出できませんでした。")
