from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from database.db_setup import AsyncSessionLocal, ActionsFlowSessionLocal


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

async def get_actions_flow_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Сессия БД actions_flow (accounts, document_entries, personal_promos).
    """
    async with ActionsFlowSessionLocal() as session:
        yield session