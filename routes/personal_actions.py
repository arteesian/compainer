from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from service.auth import require_role, get_current_user
from database.dependencies import get_actions_flow_session, get_db_session
from database.actions_flow_repo import ActionsFlowRepository
from service.api_client_service import SecureAPIClient
from service.personal_actions_service import (
    PersonalActionsService,
    PersonalActionStatus,
)
from service.exceptions import ExternalAPIError, UserNotFoundError
from routes.personal_actions_schemas import (
    PersonalActionOut,
    PersonalActionsResponse,
    PersonalActionStatusEnum,
)
from database.action_logs_repo import ActionLogsRepository
from config import settings

personal_actions_router = APIRouter(
    prefix="/api/v1/personal_actions",
    tags=["personal_actions"],
)

def get_secure_api_client_dep() -> SecureAPIClient:
    return SecureAPIClient(
        base_url="https://backoffice.pbsvc.bz/",
        timeout=15,
        max_retries=2,
    )

def get_personal_actions_service_dep(
    session: AsyncSession = Depends(get_actions_flow_session),
    api_client: SecureAPIClient = Depends(get_secure_api_client_dep),
) -> PersonalActionsService:
    return PersonalActionsService(session=session, api_client=api_client)


@personal_actions_router.get(
    "/{client_id}",
    response_model=PersonalActionsResponse,
)
async def get_personal_actions_endpoint(
    client_id: int,
    response: Response,
    offset: int = 0,
    limit: int = 10,
    service: PersonalActionsService = Depends(get_personal_actions_service_dep),
    log_session: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    # Определяем, можно ли этому пользователю смотреть VIP-клиенто
    roles = user.get("role", [])
    if isinstance(roles, str):
        roles_list = [roles]
    else:
        roles_list = roles

    allow_vip_clients = any(
        r in ["admin", "superadmin", "vip"] for r in roles_list
    )

    try:
        page = await service.get_personal_actions(
            client_id=client_id,
            offset=offset,
            limit=limit,
            allow_vip_clients=allow_vip_clients,
        )
    except UserNotFoundError as exc:
        await ActionLogsRepository.create(
            log_session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=str(client_id),
            request_type="personal_actions",
            http_status=404,
            backend_payload={"detail": str(exc)},
            error_text=str(exc),
        )
        raise HTTPException(status_code=404, detail=str(exc))
    except ExternalAPIError as exc:
        status = getattr(exc, "status_code", None) or 502
        detail = exc.message or "External API error"

        await ActionLogsRepository.create(
            log_session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=str(client_id),
            request_type="personal_actions",
            http_status=status,
            backend_payload={"detail": detail},
            error_text=detail,
        )
        raise HTTPException(status_code=status, detail=detail)
    except Exception as exc:
        await ActionLogsRepository.create(
            log_session,
            employee_email=user.get("email"),
            employee_name=None,
            client_id=str(client_id),
            request_type="personal_actions",
            http_status=500,
            backend_payload={"detail": "Internal server error"},
            error_text=str(exc),
        )
        raise HTTPException(status_code=500, detail="Internal server error")

    actions_out = [
        PersonalActionOut(
            action_id=a.action_id,
            name=a.name,
            description=a.description,
            link=a.link,
            status=_map_status_to_enum(a.status),
            start_time=a.start_time,
            finish_time=a.finish_time,
            bet_needed=a.bet_needed,
            turnover_remaining=a.turnover_remaining,
        )
        for a in page.items
    ]

    out = PersonalActionsResponse(
        client_id=client_id,
        total=page.total,
        offset=page.offset,
        limit=limit,
        actions=actions_out,
    )

    row = await ActionLogsRepository.create(
        log_session,
        employee_email=user.get("email"),
        employee_name=None,
        client_id=str(client_id),
        request_type="personal_actions",
        http_status=200,
        backend_payload=out.model_dump(),
    )
    response.headers["X-Action-Log-Id"] = str(row.id)

    return out


def _map_status_to_enum(status: PersonalActionStatus) -> PersonalActionStatusEnum:
    if status == PersonalActionStatus.AVAILABLE:
        return PersonalActionStatusEnum.available
    if status == PersonalActionStatus.ACTIVE:
        return PersonalActionStatusEnum.active
    if status == PersonalActionStatus.FINISHED:
        return PersonalActionStatusEnum.finished
    return PersonalActionStatusEnum.available
