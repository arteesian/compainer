from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Generic, List, Sequence, TypeVar

T = TypeVar("T")


class PersonalActionStatus(str, Enum):
    """
    Статус персональной акции в выдаче пользователю.
    """
    AVAILABLE = "available"   # есть в actions_flow, но ещё не активирована
    ACTIVE = "active"         # активна в BackOffice
    FINISHED = "finished"     # завершена, но не старше N дней


@dataclass
class PaginatedResult(Generic[T]):
    items: List[T]
    total: int
    offset: int
    limit: int


def paginate(items: Sequence[T], offset: int, limit: int) -> PaginatedResult[T]:
    """
    Простейшая пагинация по списку.
    """
    total = len(items)
    sliced = list(items[offset : offset + limit])
    return PaginatedResult(items=sliced, total=total, offset=offset, limit=limit)
