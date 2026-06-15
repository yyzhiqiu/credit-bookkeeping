import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    status = Column(Enum("active", "disabled"), default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # API configuration for user-triggered quota queries (e.g. Codex)
    api_type = Column(String(50), nullable=True)
    api_url = Column(String(255), nullable=True)
    api_key = Column(Text, nullable=True)
    api_account_id = Column(String(100), nullable=True)
    api_session_token = Column(Text, nullable=True)

    user = relationship("User", back_populates="accounts")
    cycles = relationship("Cycle", back_populates="account", cascade="all, delete-orphan")
    records = relationship("Record", back_populates="account", cascade="all, delete-orphan")


class Cycle(Base):
    __tablename__ = "cycles"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    cycle_number = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    weekly_budget = Column(Float, nullable=False)
    weeks_count = Column(Integer, default=4, nullable=False)
    status = Column(Enum("active", "archived"), default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="cycles")
    records = relationship("Record", back_populates="cycle", cascade="all, delete-orphan")


class Record(Base):
    __tablename__ = "records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    cycle_id = Column(String(36), ForeignKey("cycles.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    week_number = Column(Integer, nullable=False)
    remaining_pct = Column(Float, nullable=False)
    consumed_pct = Column(Float, nullable=False)
    consumed_amount = Column(Float, nullable=False, default=0.0)
    cumulative_pct = Column(Float, nullable=False, default=0.0)
    cumulative_amount = Column(Float, nullable=False, default=0.0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    cycle = relationship("Cycle", back_populates="records")
    account = relationship("Account", back_populates="records")
