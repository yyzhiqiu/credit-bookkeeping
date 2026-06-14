from mcp.server import Server
from mcp.types import Tool, TextContent, CallToolResult
from .database import SessionLocal
from . import models
from .engine import calculate_current_week, recalculate_week, get_max_recorded_week
from .routers.accounts import fetch_balance
import asyncio
import contextvars

mcp_user_id = contextvars.ContextVar("mcp_user_id", default=None)

mcp_server = Server("credit_bookkeeping")

def _get_accounts_summary() -> str:
    user_id = mcp_user_id.get()
    if not user_id:
        return "Error: Unauthorized. Missing user context."
        
    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return "Error: User not found in database."

        accounts = db.query(models.Account).filter(
            models.Account.user_id == user.id,
            models.Account.status == "active"
        ).all()

        if not accounts:
            return "No active accounts found."

        summary = []
        for acc in accounts:
            active_cycle = next((c for c in acc.cycles if c.status == "active"), None)
            if not active_cycle:
                continue
            
            max_recorded_week = get_max_recorded_week(active_cycle.records)
            week_num = calculate_current_week(active_cycle.created_at, max_recorded_week)
            
            week_records = sorted(
                [r for r in active_cycle.records if r.week_number == week_num],
                key=lambda r: r.created_at,
                reverse=True,
            )
            last_rec = week_records[0] if week_records else None
            current_remaining_pct = last_rec.remaining_pct if last_rec else 100.0

            summary.append(f"- Account ID: {acc.id} | Name: {acc.name} | Cycle: {active_cycle.cycle_number} | Week: {week_num} | Local Remaining: {current_remaining_pct}%")
        
        return "\n".join(summary)


async def _check_online_quota(account_id: str) -> str:
    user_id = mcp_user_id.get()
    if not user_id:
        return "Error: Unauthorized. Missing user context."
        
    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return "Error: User not found in database."
        
        try:
            quota = await fetch_balance(account_id=account_id, force_refresh=True, db=db, current_user=user)
            
            res = [f"Quota for {account_id}:"]
            if quota.primary_remaining_percent is not None:
                res.append(f"  - 5h Window Remaining: {quota.primary_remaining_percent:.2f}%")
            if quota.secondary_remaining_percent is not None:
                res.append(f"  - Weekly Window Remaining: {quota.secondary_remaining_percent:.2f}%")
            return "\n".join(res)
        except Exception as e:
            return f"Failed to check quota: {str(e)}"


async def _sync_and_record_expense(account_id: str, description: str) -> str:
    user_id = mcp_user_id.get()
    if not user_id:
        return "Error: Unauthorized. Missing user context."
        
    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return "Error: User not found in database."

        acc = db.query(models.Account).filter(
            models.Account.id == account_id,
            models.Account.user_id == user.id,
        ).first()
        if not acc:
            return f"Error: Account {account_id} not found."
            
        active_cycle = next((c for c in acc.cycles if c.status == "active"), None)
        if not active_cycle:
            return f"Error: Account {account_id} has no active cycle."

        max_recorded_week = get_max_recorded_week(active_cycle.records)
        week_num = calculate_current_week(active_cycle.created_at, max_recorded_week)
        
        week_records = sorted(
            [r for r in active_cycle.records if r.week_number == week_num],
            key=lambda r: r.created_at,
            reverse=True,
        )
        last_rec = week_records[0] if week_records else None
        baseline_pct = last_rec.remaining_pct if last_rec else 100.0

        try:
            quota = await fetch_balance(account_id=account_id, force_refresh=True, db=db, current_user=user)
        except Exception as e:
            return f"Error fetching online quota for diff calculation: {str(e)}"
            
        r1 = quota.primary_remaining_percent
        r2 = quota.secondary_remaining_percent
        online_remaining = r2 if r2 is not None else r1
        
        if online_remaining is None:
            return "Error: Online quota returned no valid percentage."
            
        target_week = week_num
        
        if online_remaining > baseline_pct:
            target_week = week_num + 1
            baseline_pct = 100.0
            
        consumed = baseline_pct - online_remaining
        if consumed < 0:
            consumed = 0.0

        rec = models.Record(
            cycle_id=active_cycle.id,
            account_id=account_id,
            week_number=target_week,
            remaining_pct=online_remaining,
            consumed_pct=consumed,
            consumed_amount=0.0,
            cumulative_pct=0.0,
            cumulative_amount=0.0,
            description=description,
        )
        db.add(rec)
        db.flush()
        
        recalculate_week(db, active_cycle.id, target_week)
        db.commit()

        return f"Successfully recorded expense! Consumed {consumed:.2f}% (Remaining: {online_remaining:.2f}%). Diary: '{description}'."


@mcp_server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_accounts_summary",
            description="获取所有可用活跃账号的摘要，返回账号ID、名称、当前进行到第几周，以及本地记录的剩余额度。在开始任务前调用，以确定可用的账号。",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="check_online_quota",
            description="实时查询指定账号的 Codex 线上真实剩余额度。如果想知道当前确切还能用多少，可调用此工具。",
            inputSchema={
                "type": "object",
                "properties": {
                    "account_id": {"type": "string", "description": "The account ID to check"}
                },
                "required": ["account_id"]
            }
        ),
        Tool(
            name="sync_and_record_expense",
            description="干完活后调用此工具一键记账。传入账号ID和你的工作日志，该工具会自动获取最新在线额度，计算差值并写入系统数据库。",
            inputSchema={
                "type": "object",
                "properties": {
                    "account_id": {"type": "string", "description": "The account ID"},
                    "description": {"type": "string", "description": "Brief description of the work done"}
                },
                "required": ["account_id", "description"]
            }
        )
    ]

@mcp_server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[TextContent]:
    if name == "get_accounts_summary":
        result = _get_accounts_summary()
        return [TextContent(type="text", text=result)]
    elif name == "check_online_quota":
        result = await _check_online_quota(arguments["account_id"])
        return [TextContent(type="text", text=result)]
    elif name == "sync_and_record_expense":
        result = await _sync_and_record_expense(arguments["account_id"], arguments["description"])
        return [TextContent(type="text", text=result)]
    else:
        raise ValueError(f"Unknown tool: {name}")
