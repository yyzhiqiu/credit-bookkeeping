from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv, io
from ..database import get_db
from .. import models
from ..auth import get_current_user
from ..engine import calculate_current_week, recalculate_week
from ..schemas import RecordCreate, RecordUpdate, RecordOut

router = APIRouter(prefix="/api/records", tags=["records"])


def _to_record_out(r: models.Record) -> RecordOut:
    cycle_weeks_count = r.cycle.weeks_count if r.cycle else None
    return RecordOut(
        id=r.id,
        cycle_id=r.cycle_id,
        account_id=r.account_id,
        account_name=r.account.name if r.account else None,
        cycle_number=r.cycle.cycle_number if r.cycle else None,
        cycle_weeks_count=cycle_weeks_count,
        week_number=r.week_number,
        is_extra_week=(r.week_number > cycle_weeks_count) if cycle_weeks_count is not None else None,
        remaining_pct=r.remaining_pct,
        consumed_pct=r.consumed_pct,
        consumed_amount=r.consumed_amount,
        cumulative_pct=r.cumulative_pct,
        cumulative_amount=r.cumulative_amount,
        description=r.description,
        created_at=r.created_at,
    )


def _verify_account(account_id: str, user_id: str, db: Session) -> models.Account:
    acc = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == user_id,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="账号不存在")
    return acc


# ── LIST ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[RecordOut])
def list_records(
    account_id: Optional[str] = None,
    cycle_id: Optional[str] = None,
    week_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Base: only records belonging to current user's accounts
    q = (
        db.query(models.Record)
        .join(models.Account, models.Record.account_id == models.Account.id)
        .filter(models.Account.user_id == current_user.id)
    )
    if account_id:
        q = q.filter(models.Record.account_id == account_id)
    if cycle_id:
        q = q.filter(models.Record.cycle_id == cycle_id)
    if week_number is not None:
        q = q.filter(models.Record.week_number == week_number)

    records = q.order_by(models.Record.created_at.desc()).all()
    return [_to_record_out(r) for r in records]


# ── CREATE ───────────────────────────────────────────────────────────────────

@router.post("", response_model=RecordOut, status_code=status.HTTP_201_CREATED)
def create_record(
    body: RecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_account(body.account_id, current_user.id, db)

    active_cycle = db.query(models.Cycle).filter(
        models.Cycle.account_id == body.account_id,
        models.Cycle.status == "active",
    ).first()
    if not active_cycle:
        raise HTTPException(status_code=400, detail="该账号无活跃周期，请先续费")

    max_recorded_week = (
        db.query(models.Record.week_number)
        .filter(models.Record.cycle_id == active_cycle.id)
        .order_by(models.Record.week_number.desc())
        .limit(1)
        .scalar()
        or 0
    )
    current_week = calculate_current_week(active_cycle.created_at, max_recorded_week)
    max_allowed_week = max(active_cycle.weeks_count, current_week, max_recorded_week + 1)

    if body.week_number > max_allowed_week:
        raise HTTPException(
            status_code=400,
            detail=f"业务周目前最多可填写到第 {max_allowed_week} 周",
        )

    rec = models.Record(
        cycle_id=active_cycle.id,
        account_id=body.account_id,
        week_number=body.week_number,
        remaining_pct=body.remaining_pct,
        consumed_pct=body.consumed_pct,
        consumed_amount=0.0,
        cumulative_pct=0.0,
        cumulative_amount=0.0,
        description=body.description,
    )
    db.add(rec)
    db.flush()

    recalculate_week(db, active_cycle.id, body.week_number)
    db.commit()
    db.refresh(rec)
    return _to_record_out(rec)


# ── UPDATE ───────────────────────────────────────────────────────────────────

@router.patch("/{record_id}", response_model=RecordOut)
def update_record(
    record_id: str,
    body: RecordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rec = (
        db.query(models.Record)
        .join(models.Account, models.Record.account_id == models.Account.id)
        .filter(
            models.Record.id == record_id,
            models.Account.user_id == current_user.id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")

    if body.remaining_pct is not None:
        rec.remaining_pct = body.remaining_pct
    if body.consumed_pct is not None:
        rec.consumed_pct = body.consumed_pct
    if body.description is not None:
        rec.description = body.description

    db.flush()
    recalculate_week(db, rec.cycle_id, rec.week_number)
    db.commit()
    db.refresh(rec)
    return _to_record_out(rec)


# ── DELETE ───────────────────────────────────────────────────────────────────

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rec = (
        db.query(models.Record)
        .join(models.Account, models.Record.account_id == models.Account.id)
        .filter(
            models.Record.id == record_id,
            models.Account.user_id == current_user.id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")

    cycle_id = rec.cycle_id
    week_number = rec.week_number
    db.delete(rec)
    db.flush()
    recalculate_week(db, cycle_id, week_number)
    db.commit()


# ── EXPORT CSV ───────────────────────────────────────────────────────────────

@router.get("/export/csv")
def export_csv(
    account_id: Optional[str] = None,
    cycle_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Record)
        .join(models.Account, models.Record.account_id == models.Account.id)
        .filter(models.Account.user_id == current_user.id)
    )
    if account_id:
        q = q.filter(models.Record.account_id == account_id)
    if cycle_id:
        q = q.filter(models.Record.cycle_id == cycle_id)

    records = q.order_by(models.Record.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "记录时间", "账号名称", "充值期数", "业务周",
        "登记剩余%", "本次消耗%", "本次扣费(元)",
        "本周累计消耗%", "本周累计扣费(元)", "消耗事项",
    ])
    for r in records:
        writer.writerow([
            r.created_at.strftime("%Y-%m-%d %H:%M"),
            r.account.name if r.account else "",
            f"第{r.cycle.cycle_number}期" if r.cycle else "",
            f"第{r.week_number}周（超配置）"
            if r.cycle and r.week_number > r.cycle.weeks_count
            else f"第{r.week_number}周",
            f"{r.remaining_pct}%",
            f"{r.consumed_pct}%",
            f"{r.consumed_amount:.2f}",
            f"{r.cumulative_pct}%",
            f"{r.cumulative_amount:.2f}",
            r.description or "",
        ])

    output.seek(0)
    # Add BOM for Excel UTF-8 compatibility
    content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=records_export.csv"},
    )
