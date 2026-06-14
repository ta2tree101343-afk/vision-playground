from fastapi import APIRouter

from app.schemas.common import HealthCheckResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="ヘルスチェック",
    description="サービスが正常に稼働しているかを確認します。",
    response_description='"ok" を含むレスポンス',
    responses={},
)
def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(status="ok")
