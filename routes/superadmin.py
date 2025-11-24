from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from database.schemas import UserResponse, UserFilter, UserRoleUpdate
from service.auth import require_role
from service.user_service import UserService

import io
from datetime import datetime


superadmin_router = APIRouter(prefix="/api/v1/superadmin/users", tags=["superadmin layer"])


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