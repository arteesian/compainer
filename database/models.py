from sqlalchemy import DateTime, BigInteger, String, Column, Integer
from sqlalchemy.orm import DeclarativeBase
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
    def role(self):
        if self.is_admin:
            return "admin"
        elif self.is_superadmin:
            return "superadmin"
        elif self.is_vip:
            return "vip"
        else:
            return "user"