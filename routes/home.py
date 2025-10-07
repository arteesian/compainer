from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from service.auth import get_current_user

templates = Jinja2Templates(directory="templates")
home_router = APIRouter(tags=["pages"])

@home_router.get("/home")
async def home(request: Request, user: dict = Depends(get_current_user)):
    ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()

    return templates.TemplateResponse(
        "home.html",
        {"request": request, "ip": ip, "user": user}
    )