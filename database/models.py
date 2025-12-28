from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import DateTime, BigInteger, String, Column, Integer, ForeignKey, Enum as SQLEnum, func, Text
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from sqlalchemy.sql.sqltypes import Boolean
from sqlalchemy.dialects.postgresql import JSONB


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
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

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
    name_bo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    short_rules: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_vip: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answer: Mapped[Optional[str]] = mapped_column(String(1500), nullable=True)
    players: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    state: Mapped[ActionState] = mapped_column(
        SQLEnum(ActionState, name="action_state_enum"),
        nullable=False,
        default=ActionState.ACTIVE
    )

    creation_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
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

# Модели БД actions_flow для персональных акций

class DocumentEntry(Base):
    """
    Таблица document_entries

    Поля:
    - id      (PK)
    - name    (в ней хранится actionId)
    """
    __tablename__ = "document_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # связи
    accounts: Mapped[List["Account"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )

class Account(Base):
    """
    Таблица accounts

    Поля:
    - id
    - account_number  (сюда пишется clientId)
    - document_id     (segmentId -> FK на document_entries.id)
    """
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    document_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("document_entries.id"),
        nullable=True,
        index=True,
    )

    document: Mapped[Optional["DocumentEntry"]] = relationship(
        back_populates="accounts",
    )

class PersonalPromo(Base):
    """
    personal_promos

    id          serial4      PK
    action_id   int4         NOT NULL
    promo_id    varchar      NOT NULL
    start_time  int8         NOT NULL
    finish_time int8         NOT NULL
    state       int4         NOT NULL
    link        varchar      NOT NULL
    message     varchar      (NULLABLE)
    created_at  timestamp    NOT NULL
    updated_at  timestamp    NOT NULL
    """
    __tablename__ = "personal_promos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    action_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    promo_id: Mapped[str] = mapped_column(String, nullable=False)

    # int8 → BigInteger (обычно это unix-timestamp или похожее число)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    finish_time: Mapped[int] = mapped_column(BigInteger, nullable=False)

    state: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    link: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

class WelcomePromo(Base):
    """
    Таблица welcome_promos
    (первый шаг велкома, есть ссылка и текст).
    """
    __tablename__ = "welcome_promos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    promo_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    finish_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    state: Mapped[int] = mapped_column(Integer, nullable=False)
    link: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

class WelcomeStep2(Base):
    """
    Таблица welcome_step_2 — второй этап велкома.
    """
    __tablename__ = "welcome_step_2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    promo_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    finish_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    state: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

class WelcomeStep3(Base):
    """
    Таблица welcome_step_3 — третий этап велкома.
    """
    __tablename__ = "welcome_step_3"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    promo_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    finish_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    state: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

class WelcomeStep4(Base):
    """
    Таблица welcome_step_4 — четвертый этап велкома.
    """
    __tablename__ = "welcome_step_4"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    promo_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    finish_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    state: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

class WelcomeStep5(Base):
    """
    Таблица welcome_step_5 — пятый этап велкома.
    """
    __tablename__ = "welcome_step_5"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    promo_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    finish_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    state: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

class ActionLog(Base):
    """
    Таблица записей журнала действий пользователей (логи)
    """
    __tablename__ = "action_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    employee_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    employee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    request_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    http_status: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    backend_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # сырой ответ бекенда
    error_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)
