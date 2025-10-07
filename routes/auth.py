from fastapi import APIRouter, HTTPException
from fastapi import Request
from starlette.responses import RedirectResponse

from config import settings
from service.auth import get_or_create_user

auth_router = APIRouter(tags=["auth management"])

@auth_router.get("/auth/login/google")
async def login_google(request: Request):
    # Редирект на Google
    # redirect_uri = "https://actions-compainer.paricorp.ru/auth/callback"
    redirect_uri = request.url_for("auth_callback")
    return await request.app.state.oauth.google.authorize_redirect(request, redirect_uri, prompt="select_account")


@auth_router.get("/auth/callback", name="auth_callback")
async def auth_callback(request: Request):
    try:
        token = await request.app.state.oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo") or {}
        email = user_info.get("email")
        if not email or not user_info.get("email_verified"):
            raise HTTPException(400, "Email not verified")

        # Создаем или берем из бд мэйл + роль
        user_data = await get_or_create_user(email.lower().strip())
        request.session["user"] = user_data

        # Редирект на фронтенд

        return RedirectResponse("/home")
    except Exception as e:
        print("Auth error:", e)
        return RedirectResponse(f"{settings.ORIGIN_FRONTEND}?error=auth")


@auth_router.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}

