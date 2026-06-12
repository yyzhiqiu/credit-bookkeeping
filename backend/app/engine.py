"""
逆推重算引擎：编辑/删除任意历史记录后，对同一 cycle + week 的所有记录重新累加。
"""
from datetime import datetime
from typing import Iterable, List
from sqlalchemy.orm import Session
from . import models


def calculate_elapsed_week(start_date: datetime) -> int:
    """根据周期开始日期计算自然流逝到第几业务周（1-based）"""
    now = datetime.utcnow()
    diff_days = max(0, (now - start_date).days)
    return (diff_days // 7) + 1


def get_max_recorded_week(records: Iterable[models.Record]) -> int:
    """获取当前周期已记录到的最大业务周。"""
    return max((r.week_number for r in records), default=0)


def calculate_current_week(start_date: datetime, max_recorded_week: int = 0) -> int:
    """
    计算当前业务周：
    - 以自然周推进为基础
    - 若用户因官方手动刷新等原因提前开始记录下一周，则以已记录周为准
    """
    elapsed_week = calculate_elapsed_week(start_date)
    return max(1, elapsed_week, max_recorded_week)


def recalculate_week(db: Session, cycle_id: str, week_number: int) -> None:
    """重算指定周期、指定业务周内所有记录的累计值。"""
    cycle = db.query(models.Cycle).filter(models.Cycle.id == cycle_id).first()
    if not cycle:
        return

    records: List[models.Record] = (
        db.query(models.Record)
        .filter(
            models.Record.cycle_id == cycle_id,
            models.Record.week_number == week_number,
        )
        .order_by(models.Record.created_at.asc())
        .all()
    )

    cumul_pct = 0.0
    for rec in records:
        cumul_pct += rec.consumed_pct
        rec.consumed_amount = round(cycle.weekly_budget * (rec.consumed_pct / 100), 4)
        rec.cumulative_pct = round(cumul_pct, 4)
        rec.cumulative_amount = round(cycle.weekly_budget * (cumul_pct / 100), 4)

    db.flush()
