from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from database.models import UserActionBonus
from service.exceptions import UserNotFoundError


class WagerRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_bonuses_by_user_id(self, user_id: str) -> List[UserActionBonus]:
        stmt = select(UserActionBonus).where(UserActionBonus.userid == int(user_id))
        result = await self.session.execute(stmt)
        bonuses = result.scalars().all()

        if not bonuses:
            raise UserNotFoundError(f"User {user_id} not found in database")

        return bonuses