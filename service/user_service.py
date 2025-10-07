# services/user_service.py
from database.user_repo import UserRepository
from database.schemas import UserResponse, UserFilter, UserRoleUpdate
from typing import List

class UserService:


    @staticmethod
    async def list_users(filters: UserFilter) -> List[UserResponse]:
        users = await UserRepository.get_all_users(filters.role)
        return [UserResponse.model_validate(user) for user in users]


    @staticmethod
    async def update_user_role(update_data: UserRoleUpdate) -> bool:
        return await UserRepository.set_role(
            email=update_data.email,
            is_admin=update_data.is_admin,
            is_vip=update_data.is_vip
        )