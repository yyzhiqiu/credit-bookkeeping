from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Cycle ───────────────────────────────────────────────────────────────────

class CycleOut(BaseModel):
    id: str
    account_id: str
    cycle_number: int
    amount: float
    weekly_budget: float
    weeks_count: int
    max_recorded_week: int = 0
    status: str
    created_at: datetime
    current_week_num: Optional[int] = None
    is_overdue: Optional[bool] = None

    class Config:
        from_attributes = True


# ── Account ──────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    name: str
    initial_amount: float
    weeks_count: int = 4
    api_type: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    api_account_id: Optional[str] = None
    api_session_token: Optional[str] = None

    @field_validator("initial_amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("充值金额必须大于0")
        return v

    @field_validator("weeks_count")
    @classmethod
    def weeks_valid(cls, v):
        if not (2 <= v <= 8):
            raise ValueError("周期周数必须在 2~8 之间")
        return v

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    api_type: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    api_account_id: Optional[str] = None
    api_session_token: Optional[str] = None

class RechargeRequest(BaseModel):
    amount: float
    weeks_count: int = 4

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("充值金额必须大于0")
        return v

class AccountOut(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime
    active_cycle: Optional[CycleOut] = None
    api_type: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None  # Masked value
    api_account_id: Optional[str] = None
    api_session_token: Optional[str] = None  # Masked value

    class Config:
        from_attributes = True

class AccountDeleteInfo(BaseModel):
    account_id: str
    account_name: str
    cycle_count: int
    record_count: int

# ── Codex Quota Response ─────────────────────────────────────────────────────

class CodexQuotaResponse(BaseModel):
    plan_type: Optional[str] = None
    primary_used_percent: Optional[float] = None
    primary_remaining_percent: Optional[float] = None
    primary_reset_after_seconds: Optional[int] = None
    
    secondary_used_percent: Optional[float] = None
    secondary_remaining_percent: Optional[float] = None
    secondary_reset_after_seconds: Optional[int] = None
    
    token_expires_at: Optional[datetime] = None


# ── Record ───────────────────────────────────────────────────────────────────

class RecordCreate(BaseModel):
    account_id: str
    week_number: int
    remaining_pct: float
    consumed_pct: float
    description: Optional[str] = None

    @field_validator("week_number")
    @classmethod
    def week_valid(cls, v):
        if v < 1:
            raise ValueError("业务周必须大于等于 1")
        return v

    @field_validator("remaining_pct")
    @classmethod
    def remaining_valid(cls, v):
        if v < 0 or v > 100:
            raise ValueError("剩余百分比必须在 0~100 之间")
        return v

    @field_validator("consumed_pct")
    @classmethod
    def consumed_valid(cls, v):
        if v < 0:
            raise ValueError("消耗百分比不能为负数")
        return v

class RecordUpdate(BaseModel):
    remaining_pct: Optional[float] = None
    consumed_pct: Optional[float] = None
    description: Optional[str] = None

    @field_validator("remaining_pct")
    @classmethod
    def remaining_valid(cls, v):
        if v is not None and (v < 0 or v > 100):
            raise ValueError("剩余百分比必须在 0~100 之间")
        return v

    @field_validator("consumed_pct")
    @classmethod
    def consumed_valid(cls, v):
        if v is not None and v < 0:
            raise ValueError("消耗百分比不能为负数")
        return v

class RecordOut(BaseModel):
    id: str
    cycle_id: str
    account_id: str
    account_name: Optional[str] = None
    cycle_number: Optional[int] = None
    cycle_weeks_count: Optional[int] = None
    week_number: int
    is_extra_week: Optional[bool] = None
    remaining_pct: float
    consumed_pct: float
    consumed_amount: float
    cumulative_pct: float
    cumulative_amount: float
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard ────────────────────────────────────────────────────────────────

class CycleDashboardItem(BaseModel):
    account_id: str
    account_name: str
    api_type: Optional[str] = None
    cycle_id: str
    cycle_number: int
    amount: float
    weekly_budget: float
    weeks_count: int
    current_week_num: int
    is_overdue: bool
    current_remaining_pct: float
    current_consumed_pct: float
    current_consumed_amount: float

class DashboardOut(BaseModel):
    total_active_accounts: int
    total_budget: float
    total_spent: float
    cycles: List[CycleDashboardItem]
