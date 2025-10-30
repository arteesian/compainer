from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import DateTime, BigInteger, String, Column, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from sqlalchemy.sql.sqltypes import Boolean


class Base(DeclarativeBase):
    pass


class UserActionBonus(Base):
    __tablename__ = 'wager_action_bonus'

    userid = Column(BigInteger, primary_key=True)
    action_id = Column(BigInteger, primary_key=True)

    date_start = Column(DateTime, nullable=False)
    date_end = Column(DateTime, nullable=True)
    status = Column(String, nullable=False)
    bonus_sum = Column(Integer, nullable=False)
    payback_sum = Column(Integer, nullable=False)
    date_ending = Column(DateTime, nullable=False)
    max_sum_on_balance = Column(Integer, nullable=False)
    payback_type = Column(String, nullable=False)
    status_bonus = Column(String, nullable=False)
    status_prohibition = Column(String, nullable=False)
    calculated_sum = Column(Integer, nullable=False)
    accepted_sum = Column(Integer, nullable=False)
    remaining_sum = Column(Integer, nullable=False)

    def __repr__(self):
        return f"<UserActionBonus(userid={self.userid}, action_id={self.action_id})>"


class User(Base):
    __tablename__ = "users"

    email = Column(String, primary_key=True, index=True)
    is_vip = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_superadmin = Column(Boolean, default=False, nullable=False)

    @property
    def role(self) -> list[str]:
        roles = set()
        if self.is_admin:
            roles.add("admin")
        if self.is_superadmin:
            roles.add("superadmin")
        if self.is_vip:
            roles.add("vip")
        if not roles:
            roles.add("user")
        return list(roles)


class ActionState(str, Enum):
    ACTIVE = "active"
    FINISHED = "finished"
    INACTIVE = "inactive"


class CommonAction(Base):
    __tablename__ = "common_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_rules: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_vip: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answer: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    players: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    state: Mapped[ActionState] = mapped_column(
        SQLEnum(ActionState, name="action_state_enum"),
        nullable=False,
        default=ActionState.ACTIVE
    )

    questions_answers: Mapped[List["QuestionAnswer"]] = relationship(
        back_populates="action",
        cascade="all, delete-orphan",
        foreign_keys="QuestionAnswer.action_id"
    )


class QuestionAnswer(Base):
    __tablename__ = "questions_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[int] = mapped_column(
        ForeignKey("common_actions.id", ondelete="CASCADE"),
        nullable=False
    )

    question: Mapped[str] = mapped_column(String(1000), nullable=False)
    answer: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    who_sent: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)

    action: Mapped["CommonAction"] = relationship(
        back_populates="questions_answers",
        foreign_keys="[QuestionAnswer.action_id]"
    )