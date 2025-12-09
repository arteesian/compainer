# repositories/user_repository.py
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError
from database.models import User
from database.db_setup import AsyncSessionLocal
from typing import Optional, Dict
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class UserRepository:


    @staticmethod
    async def get_or_create_user(email: str) -> Dict[str, list[str]]:
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()

                if user is None:
                    user = User(email=email)
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)
                else:
                    await session.commit()

                return {"email": user.email, "role": user.role}

            except SQLAlchemyError as e:
                await session.rollback()
                raise Exception(f"DB error: {e}") from e

    @staticmethod
    async def update_user_last_activity(email: str):
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()
                if not user:
                    return

                user.last_activity_at = datetime.now(timezone.utc)
                await session.commit()

            except SQLAlchemyError as e:
                await session.rollback()
                logger.error(f"Failed to update last activity for {email}: {e}")


    @staticmethod
    async def set_role(email: str, is_admin: bool = None, is_vip: bool = None) -> bool:
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()
                if not user:
                    return False

                if is_admin is not None:
                    user.is_admin = is_admin
                if is_vip is not None:
                    user.is_vip = is_vip

                await session.commit()
                return True
            except SQLAlchemyError as e:
                print(f"SQLALCH Error: {e}")
                await session.rollback()
                return False


    @staticmethod
    async def get_all_users(role_filter: Optional[str] = None) -> list[User]:
        async with AsyncSessionLocal() as session:
            query = select(User)

            if role_filter == "admin":
                query = query.where(User.is_admin == True)
            elif role_filter == "vip":
                query = query.where(User.is_vip == True)
            elif role_filter == "user":
                query = query.where(User.is_vip == False, User.is_admin == False)

            query = query.order_by(
                User.last_activity_at.desc().nulls_last()
            )

            result = await session.execute(query)
            return result.scalars().all()

    @staticmethod
    async def delete_user(email: str) -> bool:
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()
                if not user or user.is_superadmin:
                    return False

                await session.delete(user)
                await session.commit()
                return True

            except SQLAlchemyError as e:
                await session.rollback()
                logger.error(f"Failed to delete user {email}: {e}")
                return False