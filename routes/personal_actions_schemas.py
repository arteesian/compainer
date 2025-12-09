from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel

class PersonalActionStatusEnum(str, Enum):
    available = "available"
    active = "active"
    finished = "finished"

class PersonalActionOut(BaseModel):
    action_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    link: Optional[str] = None

    status: PersonalActionStatusEnum
    start_time: Optional[datetime] = None
    finish_time: Optional[datetime] = None

    bet_needed: Optional[bool] = None
    turnover_remaining: Optional[float] = None

    class Config:
        orm_mode = False

class PersonalActionsResponse(BaseModel):
    client_id: int
    total: int
    offset: int
    limit: int
    actions: List[PersonalActionOut]