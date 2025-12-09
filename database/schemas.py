from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, Literal, List
from enum import Enum


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
    last_activity_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserFilter(BaseModel):
    role: Optional[Literal["user", "vip", "admin"]] = None


class UserRoleUpdate(BaseModel):
    email: str
    is_vip: Optional[bool] = None
    is_admin: Optional[bool] = None


class ActionStateEnum(str, Enum):
    active = "active"
    finished = "finished"
    inactive = "inactive"


# === Вопросы-ответы ===
class QuestionAnswerBase(BaseModel):
    question: str = Field(..., max_length=1000)
    answer: Optional[str] = Field(None, max_length=1000)
    is_approved: bool = False
    who_sent: Optional[EmailStr] = None


class QuestionAnswerCreate(QuestionAnswerBase):
    pass


class QuestionAnswerUpdate(QuestionAnswerBase):
    question: Optional[str] = None  # для partial update


    class Config:
        from_attributes = True

class QuestionAnswerOut(QuestionAnswerBase):
    id: int
    action_id: int

    class Config:
        from_attributes = True


# === Акции ===
class CommonActionBase(BaseModel):
    name: str = Field(..., max_length=255)
    name_bo: Optional[str] = Field(None, max_length=255)
    short_rules: Optional[str] = Field(None, max_length=1000)
    link: Optional[str] = Field(None, max_length=500)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_vip: bool = False
    answer: Optional[str] = Field(None, max_length=1500)
    players: Optional[str] = Field(None, max_length=500)
    state: ActionStateEnum = ActionStateEnum.active

    class Config:
        from_attributes = True

class CommonActionCreate(CommonActionBase):
    end_time: datetime

    class Config:
        from_attributes = True

class CommonActionUpdate(CommonActionBase):
    name: Optional[str] = None
    name_bo: Optional[str] = None
    answer: Optional[str] = None
    end_time: Optional[datetime] = None

    class Config:
        from_attributes = True

class CommonActionOut(CommonActionBase):
    id: int
    creation_time: datetime
    questions_answers: List[QuestionAnswerOut] = []

    class Config:
        from_attributes = True


class SendFreebetRequest(BaseModel):
    clientId: str


class FreebetResultResponse(BaseModel):
    result: str


class FreebetErrorResponse(BaseModel):
    error: str
