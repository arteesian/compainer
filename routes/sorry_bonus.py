from fastapi import APIRouter, HTTPException, Depends
from starlette import status
from starlette.responses import JSONResponse

from database.schemas import UserResponse, UserFilter, UserRoleUpdate, SendFreebetRequest
from routes.wager_schemas import ClientIdSchema
from service.api_client_service import SecureAPIClient, logger
from service.auth import require_role, get_current_user
from service.exceptions import ExternalAPIError
from service.sorry_bonus_service import SorryBonusService
from service.user_service import UserService


sorry_bonus_router = APIRouter(prefix="/api/v1", tags=["акции,персональное"])


@sorry_bonus_router.post(
    "/sorry_bonus",
    summary="Получить объединённые данные пользователя по сорри бонусу (евро бонусу)",
    description="""
    Получает данные из БО и 1с по доступности фрибета.
    """
)
async def get_combined_user_data(
        request: ClientIdSchema,
        user: dict = Depends(get_current_user)
):
    try:
        api_client = SecureAPIClient(
            base_url="https://backoffice.pbsvc.bz/",
            timeout=15,
            max_retries=2  # 1 оригинал + 1 retry при истечении fsid'a
        )

        sorry_bonus = SorryBonusService(api_client)

        return await sorry_bonus.get_combined_response_euro_bonus(request.client_id)

    except ExternalAPIError as e:
        # Ошибки бэкоффиса (включая проблемы с фсидом после всех retry)
        raise HTTPException(
            status_code=e.status_code or status.HTTP_502_BAD_GATEWAY,
            detail=f"External API error: {e.message}"
        )
    except Exception as e:
        # тут логи нада
        logger.error(f"Необработанная ошибка для client_id={request.client_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )



@sorry_bonus_router.post(
    "/acquire_freebet",
    summary="Передать фрибет на начисление",
    description="""
    Передаем фрибет на начисление в 1с в виде тикета
    """
)
async def ship_freebet_to_fapi(
        request: SendFreebetRequest,
        user: dict = Depends(get_current_user)
):
    try:
        api_client = SecureAPIClient(
            base_url="https://backoffice.pbsvc.bz/",
            timeout=15,
            max_retries=2  # 1 оригинал + 1 retry при истечении fsid'a
        )

        sorry_bonus = SorryBonusService(api_client)

        response = await sorry_bonus.ship_freebet(request.clientId, user.get("email"))
        if response.get("errorText", None) is not None:
            return JSONResponse(
                status_code=400,
                content=response
            )
        return {"result": "success"}

    except ExternalAPIError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_502_BAD_GATEWAY,
            detail=f"External API error: {e.message}"
        )
    except Exception as e:
        # тут логи нада
        logger.error(f"Необработанная ошибка для client_id={request.client_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )