from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.dependencies import get_db_session
from service.common_actions_service import CommonActionService


def get_action_service_dep(session: AsyncSession = Depends(get_db_session)):
    return CommonActionService(session)