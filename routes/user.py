from fastapi import APIRouter, HTTPException, Depends

from service.auth import get_current_user, require_role
from database.user_repo import UserRepository

user_router = APIRouter(tags=["user management"])


@user_router.get("/api/me")
async def get_me(user: dict = Depends(get_current_user)):
    # Смотрим в куках роль и отдаем на фронт
    return {
        "email": user["email"],
        "role": user["role"]
    }

@user_router.get("/api/admin")
async def admin_only(admin: dict = Depends(require_role("admin"))):
    return {"message": "Welcome to admin panel!", "email": admin["email"]}
