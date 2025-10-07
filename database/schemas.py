from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal


class UserActionBonusResponse(BaseModel):
    userid: int
    action_id: int
    date_start: datetime
    date_end: Optional[datetime]
    status: str
    bonus_sum: int
    payback_sum: int
    date_ending: datetime
    max_sum_on_balance: int
    payback_type: str
    status_bonus: str
    status_prohibition: str
    calculated_sum: int
    accepted_sum: int
    remaining_sum: int

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    email: str
    is_vip: bool
    is_admin: bool

    class Config:
        from_attributes = True


class UserFilter(BaseModel):
    role: Optional[Literal["user", "vip", "admin"]] = None


class UserRoleUpdate(BaseModel):
    email: str
    is_vip: Optional[bool] = None
    is_admin: Optional[bool] = None