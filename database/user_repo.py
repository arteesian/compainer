# repositories/user_repository.py
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError
from database.models import User
from database.db_setup import AsyncSessionLocal
from typing import Optional, Dict

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

            result = await session.execute(query)
            return result.scalars().all()