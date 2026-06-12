from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..auth import get_current_user
from ..engine import calculate_current_week, get_max_recorded_week
from ..schemas import (
    AccountCreate, AccountUpdate, AccountOut, AccountDeleteInfo,
    RechargeRequest, CycleOut, DashboardOut, CycleDashboardItem,
)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _build_cycle_out(cycle: models.Cycle) -> Optional[CycleOut]:
    if cycle is None:
        return None
    max_recorded_week = get_max_recorded_week(cycle.records)
    week = calculate_current_week(cycle.created_at, max_recorded_week)
    return CycleOut(
        id=cycle.id,
        account_id=cycle.account_id,
        cycle_number=cycle.cycle_number,
        amount=cycle.amount,
        weekly_budget=cycle.weekly_budget,
        weeks_count=cycle.weeks_count,
        max_recorded_week=max_recorded_week,
        status=cycle.status,
        created_at=cycle.created_at,
        current_week_num=week,
        is_overdue=week > cycle.weeks_count,
    )


def _build_account_out(acc: models.Account) -> AccountOut:
    active_cycle = next((c for c in acc.cycles if c.status == "active"), None)
    return AccountOut(
        id=acc.id,
        name=acc.name,
        status=acc.status,
        created_at=acc.created_at,
        active_cycle=_build_cycle_out(active_cycle),
    )


# ── LIST ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[AccountOut])
def list_accounts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    accounts = (
        db.query(models.Account)
        .filter(models.Account.user_id == current_user.id)
        .order_by(models.Account.created_at.asc())
        .all()
    )
    return [_build_account_out(a) for a in accounts]


# ── CREATE ───────────────────────────────────────────────────────────────────

@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    body: AccountCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from datetime import datetime
    now = datetime.utcnow()
    acc = models.Account(user_id=current_user.id, name=body.name, created_at=now)
    db.add(acc)
    db.flush()

    cycle = models.Cycle(
        account_id=acc.id,
        cycle_number=1,
        amount=body.initial_amount,
        weekly_budget=round(body.initial_amount / body.weeks_count, 4),
        weeks_count=body.weeks_count,
        status="active",
        created_at=now,
    )
    db.add(cycle)
    db.commit()
    db.refresh(acc)
    return _build_account_out(acc)


# ── UPDATE ───────────────────────────────────────────────────────────────────

@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: str,
    body: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    acc = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="账号不存在")
    if body.name is not None:
        acc.name = body.name
    if body.status is not None:
        if body.status not in ("active", "disabled"):
            raise HTTPException(status_code=400, detail="状态值无效")
        acc.status = body.status
    db.commit()
    db.refresh(acc)
    return _build_account_out(acc)


# ── DELETE INFO (preview before delete) ──────────────────────────────────────

@router.get("/{account_id}/delete-info", response_model=AccountDeleteInfo)
def delete_info(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    acc = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="账号不存在")
    cycle_count = db.query(models.Cycle).filter(models.Cycle.account_id == account_id).count()
    record_count = db.query(models.Record).filter(models.Record.account_id == account_id).count()
    return AccountDeleteInfo(
        account_id=acc.id,
        account_name=acc.name,
        cycle_count=cycle_count,
        record_count=record_count,
    )


# ── DELETE ───────────────────────────────────────────────────────────────────

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    acc = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="账号不存在")
    db.delete(acc)
    db.commit()


# ── RECHARGE (new cycle) ──────────────────────────────────────────────────────

@router.post("/{account_id}/recharge", response_model=AccountOut)
def recharge(
    account_id: str,
    body: RechargeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from datetime import datetime
    acc = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="账号不存在")
    if acc.status == "disabled":
        raise HTTPException(status_code=400, detail="已停用的账号无法续费")

    # archive current active cycle
    cycles = db.query(models.Cycle).filter(
        models.Cycle.account_id == account_id,
        models.Cycle.status == "active",
    ).all()
    max_num = 0
    for c in cycles:
        c.status = "archived"
        if c.cycle_number > max_num:
            max_num = c.cycle_number

    new_cycle = models.Cycle(
        account_id=account_id,
        cycle_number=max_num + 1,
        amount=body.amount,
        weekly_budget=round(body.amount / body.weeks_count, 4),
        weeks_count=body.weeks_count,
        status="active",
        created_at=datetime.utcnow(),
    )
    db.add(new_cycle)
    db.commit()
    db.refresh(acc)
    return _build_account_out(acc)


# ── DASHBOARD ─────────────────────────────────────────────────────────────────

@router.get("/dashboard/summary", response_model=DashboardOut, tags=["dashboard"])
def dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    accounts = (
        db.query(models.Account)
        .filter(
            models.Account.user_id == current_user.id,
            models.Account.status == "active",
        )
        .all()
    )

    items = []
    total_budget = 0.0
    total_spent = 0.0

    for acc in accounts:
        active_cycle = next((c for c in acc.cycles if c.status == "active"), None)
        if not active_cycle:
            continue

        max_recorded_week = get_max_recorded_week(active_cycle.records)
        week_num = calculate_current_week(active_cycle.created_at, max_recorded_week)
        display_week = week_num
        is_overdue = week_num > active_cycle.weeks_count

        week_records = sorted(
            [r for r in active_cycle.records if r.week_number == display_week],
            key=lambda r: r.created_at,
            reverse=True,
        )
        last_rec = week_records[0] if week_records else None

        current_remaining_pct = last_rec.remaining_pct if last_rec else 100.0
        current_consumed_pct = last_rec.cumulative_pct if last_rec else 0.0
        current_consumed_amount = round(
            active_cycle.weekly_budget * (current_consumed_pct / 100), 4
        )

        total_budget += active_cycle.amount
        total_spent += sum(r.consumed_amount for r in active_cycle.records)

        items.append(CycleDashboardItem(
            account_id=acc.id,
            account_name=acc.name,
            cycle_id=active_cycle.id,
            cycle_number=active_cycle.cycle_number,
            amount=active_cycle.amount,
            weekly_budget=active_cycle.weekly_budget,
            weeks_count=active_cycle.weeks_count,
            current_week_num=week_num,
            is_overdue=is_overdue,
            current_remaining_pct=current_remaining_pct,
            current_consumed_pct=current_consumed_pct,
            current_consumed_amount=current_consumed_amount,
        ))

    return DashboardOut(
        total_active_accounts=len(accounts),
        total_budget=round(total_budget, 4),
        total_spent=round(total_spent, 4),
        cycles=items,
    )
