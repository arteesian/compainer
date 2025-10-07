from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from config import settings
from routes.auth import auth_router
from routes.superadmin import superadmin_router
from routes.user import user_router
from routes.wager import router as wager_router



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


    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.ORIGIN_FRONTEND, settings.ORIGIN_FRONTEND_BACKUP],  # фронтенд
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Сессии
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SESSION_SECRET_KEY,
        same_site="lax",
        # max_age=30,
        https_only=False,
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

    app.state.oauth = oauth

    app.include_router(wager_router)
    app.include_router(user_router)
    app.include_router(auth_router)
    app.include_router(superadmin_router)


    return app






