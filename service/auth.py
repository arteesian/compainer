from fastapi import Request, HTTPException
from database.user_repo import UserRepository
import logging

logger = logging.getLogger(__name__)


async def get_or_create_user(email: str) -> dict:
    try:
        return await UserRepository.get_or_create_user(email)
    except Exception as e:
        logger.error(f"Auth DB error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")


def get_current_user(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_role(required_role: str):

    def role_checker(request: Request):
        user = get_current_user(request)
        if user.get("role") != required_role:
            raise HTTPException(status_code=403, detail=f"{required_role.title()} access required")
        return user

    return role_checker