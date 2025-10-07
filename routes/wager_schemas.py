import re
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, field_validator


class ClientIdSchema(BaseModel):
    client_id: str

    @field_validator("client_id")
    def validate_code(cls, value):
        if not re.fullmatch(r"^\d{8}$", value):
            raise ValueError("Номер счета должен быть строкой из ровно 8 цифр")
        return value

    class Config:
        from_attributes = True



class UserActionBonusDB(BaseModel):
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


class UserProfileAPI(BaseModel):
    user_id: int
    full_name: str
    email: str
    tier: str
    is_active: bool


class UserActionBonusExtended(BaseModel):
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

    action_name: str | None
    rules: str | None
    url: str | None

    class Config:
        from_attributes = True

class CombinedUserResponse(BaseModel):
    user_id: str
    actions: List[UserActionBonusExtended]