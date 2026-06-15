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
    CodexQuotaResponse,
)
import httpx
import base64
import json
from datetime import datetime, timezone

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

def _get_jwt_exp(token: str) -> Optional[datetime]:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        payload_b64 += '=' * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)
        exp = payload.get('exp')
        if exp:
            return datetime.fromtimestamp(exp, tz=timezone.utc)
    except Exception:
        pass
    return None


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
    
    masked_key = None
    if acc.api_key:
        if len(acc.api_key) <= 12:
            masked_key = "******"
        else:
            masked_key = f"{acc.api_key[:6]}******{acc.api_key[-6:]}"
            
    masked_session_token = None
    if acc.api_session_token:
        if len(acc.api_session_token) <= 12:
            masked_session_token = "******"
        else:
            masked_session_token = f"{acc.api_session_token[:6]}******{acc.api_session_token[-6:]}"

    return AccountOut(
        id=acc.id,
        name=acc.name,
        status=acc.status,
        created_at=acc.created_at,
        active_cycle=_build_cycle_out(active_cycle),
        api_type=acc.api_type,
        api_url=acc.api_url,
        api_key=masked_key,
        api_account_id=acc.api_account_id,
        api_session_token=masked_session_token,
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
    acc = models.Account(
        user_id=current_user.id,
        name=body.name,
        created_at=now,
        api_type=body.api_type,
        api_url=body.api_url,
        api_key=body.api_key,
        api_account_id=body.api_account_id,
        api_session_token=body.api_session_token,
    )
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
    if body.api_type is not None:
        acc.api_type = body.api_type
    if body.api_url is not None:
        acc.api_url = body.api_url
    if body.api_key is not None:
        if body.api_key == "":
            acc.api_key = None
        elif "***" not in body.api_key:
            acc.api_key = body.api_key
    if body.api_account_id is not None:
        acc.api_account_id = body.api_account_id
    if body.api_session_token is not None:
        if body.api_session_token == "":
            acc.api_session_token = None
        elif "***" not in body.api_session_token:
            acc.api_session_token = body.api_session_token
        
    db.commit()
    db.refresh(acc)
    try:
        from app.cache import delete_cached_quota
        delete_cached_quota(account_id)
    except Exception as e:
        print(f"Error clearing cache on update: {e}")
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
            api_type=acc.api_type,
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


# ── REFRESH TOKEN HELPER ──────────────────────────────────────────────────────

async def _refresh_session_token(acc: models.Account, db: Session) -> bool:
    if not acc.api_session_token:
        return False
        
    session_value = acc.api_session_token.strip()
    if "=" not in session_value:
        cookie_header = f"__Secure-next-auth.session-token={session_value}"
    else:
        segments = session_value.split(";")
        matched_cookies = []
        for segment in segments:
            segment = segment.strip()
            if not segment:
                continue
            if "=" in segment:
                key, val = segment.split("=", 1)
                key = key.strip()
                val = val.strip()
                if key == "__Secure-next-auth.session-token" or key.startswith("__Secure-next-auth.session-token."):
                    matched_cookies.append(f"{key}={val}")
        if matched_cookies:
            cookie_header = "; ".join(matched_cookies)
        else:
            cookie_header = session_value
            
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": cookie_header
    }
    
    base_url = acc.api_url or "https://chatgpt.com"
    base_url = base_url.rstrip("/")
    session_url = f"{base_url}/api/auth/session"
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(session_url, headers=headers, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                new_token = data.get("accessToken")
                if new_token:
                    acc.api_key = new_token
                    db.commit()
                    db.refresh(acc)
                    return True
    except Exception as e:
        print(f"Error refreshing session token: {e}")
    return False


# ── FETCH REAL-TIME BALANCE ──────────────────────────────────────────────────

@router.get("/{account_id}/fetch-balance", response_model=CodexQuotaResponse)
async def fetch_balance(
    account_id: str,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Try getting from Redis cache first if force_refresh is False
    from app.cache import get_cached_quota, set_cached_quota
    
    if not force_refresh:
        cached_data = get_cached_quota(account_id)
        if cached_data:
            return CodexQuotaResponse(**cached_data)

    acc = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(status_code=404, detail="账号不存在")
        
    if not acc.api_type or acc.api_type == "disabled":
        raise HTTPException(status_code=400, detail="该账号未配置 API 额度查询")
        
    # Auto refresh if token is missing or expired and session token exists
    should_refresh = False
    if acc.api_session_token:
        if not acc.api_key:
            should_refresh = True
        else:
            exp = _get_jwt_exp(acc.api_key)
            if not exp or exp < datetime.now(timezone.utc):
                should_refresh = True
                
    if should_refresh:
        await _refresh_session_token(acc, db)
        
    if not acc.api_key:
        raise HTTPException(status_code=400, detail="该账号未配置 API Token 且无法通过 Session Cookie 自动刷新")
        
    base_url = acc.api_url or "https://chatgpt.com"
    base_url = base_url.rstrip("/")
    
    headers = {
        "Authorization": f"Bearer {acc.api_key}",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if acc.api_account_id:
        headers["ChatGPT-Account-Id"] = acc.api_account_id
        
    url = f"{base_url}/backend-api/wham/usage"
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(url, headers=headers, timeout=10.0)
            
            # If 401 Unauthorized and we have a session token, try refreshing and retrying
            if response.status_code == 401 and acc.api_session_token:
                refreshed = await _refresh_session_token(acc, db)
                if refreshed:
                    headers["Authorization"] = f"Bearer {acc.api_key}"
                    response = await client.get(url, headers=headers, timeout=10.0)
            
            # If wham/usage fails, try codex/usage
            if response.status_code != 200:
                alt_url = f"{base_url}/backend-api/codex/usage"
                alt_response = await client.get(alt_url, headers=headers, timeout=10.0)
                
                # If retry alt_response is 401, retry refresh as well
                if alt_response.status_code == 401 and acc.api_session_token:
                    refreshed = await _refresh_session_token(acc, db)
                    if refreshed:
                        headers["Authorization"] = f"Bearer {acc.api_key}"
                        alt_response = await client.get(alt_url, headers=headers, timeout=10.0)
                        
                if alt_response.status_code == 200:
                    response = alt_response
                    
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"请求 Codex 官方接口失败: {response.text[:200]}"
                )
                
            data = response.json()
            rate_limit = data.get("rate_limit", {})
            primary = rate_limit.get("primary_window") or {}
            secondary = rate_limit.get("secondary_window") or {}
            
            prim_used = primary.get("used_percent")
            sec_used = secondary.get("used_percent")
            
            prim_rem = 100.0 - prim_used if prim_used is not None else None
            sec_rem = 100.0 - sec_used if sec_used is not None else None
            
            quota_resp = CodexQuotaResponse(
                plan_type=data.get("plan_type"),
                primary_used_percent=prim_used,
                primary_remaining_percent=prim_rem,
                primary_reset_after_seconds=primary.get("reset_after_seconds"),
                secondary_used_percent=sec_used,
                secondary_remaining_percent=sec_rem,
                secondary_reset_after_seconds=secondary.get("reset_after_seconds"),
                token_expires_at=_get_jwt_exp(acc.api_key)
            )
            try:
                set_cached_quota(account_id, quota_resp.model_dump())
            except Exception as e:
                print(f"Error caching quota response: {e}")
            return quota_resp
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"网络请求失败，请检查 API 地址或代理设置: {str(exc)}"
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(
            status_code=500,
            detail=f"解析额度数据失败: {str(exc)}"
        )
