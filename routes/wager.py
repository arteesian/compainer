from fastapi import FastAPI, Depends, HTTPException, status, APIRouter, Response
from sqlalchemy.ext.asyncio import AsyncSession
from database.dependencies import get_db_session
from service.auth import get_current_user
from service.wager_service import UserWagerService
from service.api_client_service import SecureAPIClient, logger
from routes.wager_schemas import CombinedUserResponse, ClientIdSchema
from service.exceptions import ExternalAPIError, UserNotFoundError
from database.action_logs_repo import ActionLogsRepository
import os

router = APIRouter(prefix="/api/v1", tags=["акции, персональное"])

@router.post(
    "/wager",
    response_model=CombinedUserResponse,
    summary="Получить объединённые данные пользователя по вагеру",
    description="""
    Получает данные из БД и БО по акциям с бонусным счетом.
    """
)
async def get_combined_user_data(
        request: ClientIdSchema,
        response: Response,
        session: AsyncSession = Depends(get_db_session),
        user: dict = Depends(get_current_user)
):

    try:
        api_client = SecureAPIClient(
            base_url="https://backoffice.pbsvc.bz/",
            timeout=15,
            max_retries=2  # 1 оригинал + 1 retry при истечении fsid'a
        )

        service = UserWagerService(session, api_client)
        result = await service.get_combined_user_data(request.client_id)

        row = await ActionLogsRepository.create(
            session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=request.client_id,
            request_type="wager",
            http_status=200,
            backend_payload=result.model_dump() if hasattr(result, "model_dump") else result,
        )

        response.headers["X-Action-Log-Id"] = str(row.id)
        return result


    except UserNotFoundError as e:
        await ActionLogsRepository.create(
            session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=request.client_id,
            request_type="wager",
            http_status=status.HTTP_404_NOT_FOUND,
            backend_payload={"detail": str(e)},
            error_text=str(e),

        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ExternalAPIError as e:
        # Ошибки внешнего API (включая проблемы с фсидом после всех retry)
        st = e.status_code or status.HTTP_502_BAD_GATEWAY
        await ActionLogsRepository.create(
            session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=request.client_id,
            request_type="wager",
            http_status=st,
            backend_payload={"detail": f"External API error: {e.message}"},
            error_text=e.message,
        )
        raise HTTPException(status_code=st, detail=f"External API error: {e.message}")
    except Exception as e:
        logger.error(f"Необработанная ошибка для client_id={request.client_id}: {e}")
        await ActionLogsRepository.create(
            session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=request.client_id,
            request_type="wager",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            backend_payload={"detail": "Internal server error"},
            error_text=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )