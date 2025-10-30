from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Depends
from pathlib import Path
from config import settings
from routes.common_actions_routers import common_actions_router
from routes.auth import auth_router
from routes.superadmin import superadmin_router
from routes.user import user_router
from routes.wager import router as wager_router
from routes.personal import personal_router
from routes.sorry_bonus import sorry_bonus_router
from service.auth import get_current_user_optional
from service.auth import require_role

BASE_DIR = Path(__file__).resolve().parent

def create_app():
    app = FastAPI(title="Pari Compainer",
                  description="Pari Actions in one place",
                  debug=True,
                  docs_url="/api/docs")

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
            request: Request, exc: RequestValidationError
    ):
        errors = []
        for error in exc.errors():
            field = ".".join(map(str, error["loc"][1:]))
            message = error["msg"]
            errors.append({
                "field": field,
                "message": message
            })

        return JSONResponse(
            status_code=422,
            content={
                "transfer_needed": True,
                "error": "Validation failed",
                "details": "Incorrect input: Must be an 8-digit string"
            },
        )


    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "message": "Something went wrong on our side. Please try again later.",
                "details": {
                    "type": type(exc).__name__,
                    "description": str(exc) or "No description provided"
                }
            }
        )

    # Сессии
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SESSION_SECRET_KEY,
        same_site="none",
        # max_age=30,
        https_only=True,
    )

    # OAuth
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

    @app.get("/home", response_class=HTMLResponse)
    async def home(request: Request):
        return app.state.templates.TemplateResponse("home.html", {"request": request})
    
    @app.get("/personal", response_class=HTMLResponse)
    async def personal(request: Request):
        return app.state.templates.TemplateResponse("personal.html", {"request": request})
    
    @app.get("/wager", response_class=HTMLResponse)
    async def wager(request: Request):
        return app.state.templates.TemplateResponse("wager.html", {"request": request})
    
    @app.get("/tablo", response_class=HTMLResponse)
    async def tablo(request: Request):
        return app.state.templates.TemplateResponse("tablo.html", {"request": request})
    
    @app.get("/vip_tablo", response_class=HTMLResponse)
    async def vip_tablo(request: Request, user: dict = Depends(require_role("vip"))):
        return app.state.templates.TemplateResponse("vip_tablo.html", {"request": request, "role": user.get("role")})
    
    @app.get("/vip_wager", response_class=HTMLResponse)
    async def vip_wager(request: Request, user: dict = Depends(require_role("vip"))):
        return app.state.templates.TemplateResponse("vip_wager.html", {"request": request, "role": user.get("role")})
    
    @app.get("/vip_home", response_class=HTMLResponse)
    async def vip_home(request: Request, user: dict = Depends(require_role("vip"))):
        return app.state.templates.TemplateResponse("vip_home.html", {"request": request, "role": user.get("role")})
    
    @app.get("/admin_home", response_class=HTMLResponse)
    async def admin_home(request: Request, user: dict = Depends(require_role("admin"))):
        return app.state.templates.TemplateResponse("admin_home.html", {"request": request, "role": user.get("role")})
    
    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def root(request: Request, user: dict | None = Depends(get_current_user_optional)):
        # app.state.templates уже создаётся выше в main.py
        return app.state.templates.TemplateResponse("index.html", {
            "request": request,
            "user": user
        })
    
    @app.get("/superadmin", response_class=HTMLResponse)
    async def superadmin_page(request: Request, superadmin: dict = Depends(require_role("superadmin"))):
        # только суперадмин увидит страницу; иначе 403
        return app.state.templates.TemplateResponse("superadmin.html", {"request": request, "user": superadmin})


    app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
    templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

    app.state.templates = templates
    app.state.oauth = oauth

    app.include_router(wager_router)
    app.include_router(user_router)
    app.include_router(auth_router)
    app.include_router(superadmin_router)
    app.include_router(personal_router)
    app.include_router(sorry_bonus_router)
    app.include_router(common_actions_router)

    return app