from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from database.schemas import UserResponse, UserFilter, UserRoleUpdate
from service.auth import require_role
from service.user_service import UserService

import io
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db_session
from database.action_logs_repo import ActionLogsRepository

superadmin_router = APIRouter(prefix="/api/v1/superadmin/users", tags=["superadmin layer"])
superadmin_logs_router = APIRouter(prefix="/api/v1/superadmin/action-logs", tags=["superadmin layer"])

class ActionLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    employee_email: str
    employee_name: str | None
    client_id: str
    request_type: str
    http_status: int
    backend_payload: dict | None
    error_text: str | None
    final_text: str | None

@superadmin_logs_router.get("/", response_model=list[ActionLogResponse])
async def get_action_logs(
    limit: int = 50,
    offset: int = 0,
    request_type: str | None = None,
    employee_email: str | None = None,
    client_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    session: AsyncSession = Depends(get_db_session),
    superadmin: dict = Depends(require_role("superadmin")),
):
    rows = await ActionLogsRepository.list(
        session,
        limit=limit,
        offset=offset,
        request_type=request_type,
        employee_email=employee_email,
        client_id=client_id,
        date_from=date_from,
        date_to=date_to,
    )
    return rows



@superadmin_router.get("/", response_model=list[UserResponse])
async def get_users(
    filters: UserFilter = Depends(),
    superadmin: dict = Depends(require_role("superadmin"))
):
    return await UserService.list_users(filters)


@superadmin_router.patch("/role", response_model=dict)
async def update_user_role(
    update_data: UserRoleUpdate,
    superadmin: dict = Depends(require_role("superadmin"))
):
    if not await UserService.update_user_role(update_data):
        raise HTTPException(404, "User not found")
    return {"status": "updated", "email": update_data.email}


@superadmin_router.delete("/{email}", response_model=dict)
async def delete_user(
    email: str,
    superadmin: dict = Depends(require_role("superadmin"))
):
    """
    Удаление пользователя из таблицы users по email.
    Доступно только супер-админу.
    """
    if not await UserService.delete_user(email):
        raise HTTPException(404, "User not found")

    return {"status": "deleted", "email": email}

@superadmin_router.get("/export", summary="Экспорт пользователей в Excel")
async def export_users(
    filters: UserFilter = Depends(),
    superadmin: dict = Depends(require_role("superadmin"))
):
    """
    Возвращает Excel-файл со списком пользователей.
    Фильтры такие же, как у списка (role=admin/vip/user/None).
    """
    file_bytes = await UserService.export_users_to_excel(filters)

    filename = "users_export_" + datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".xlsx"

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
