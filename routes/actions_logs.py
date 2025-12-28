from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db_session
from database.action_logs_repo import ActionLogsRepository
from service.auth import get_current_user


router = APIRouter(prefix="/api/v1/action-logs", tags=["action logs"])


class ActionLogFinalizeRequest(BaseModel):
    log_id: int = Field(..., ge=1)
    final_text: str = Field(..., min_length=1, max_length=10000)

@router.patch("/finalize")
async def finalize_action_log(
    body: ActionLogFinalizeRequest,
    session: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    ok = await ActionLogsRepository.update_final_text(
        session,
        log_id=body.log_id,
        final_text=body.final_text,
        employee_email=user.get("email"),
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"ok": True}
