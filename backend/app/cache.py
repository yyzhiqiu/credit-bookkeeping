import json
import redis
from app.config import settings

_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                socket_timeout=2.0
            )
        except Exception as e:
            print(f"Error initializing Redis client: {e}")
    return _redis_client

def get_cached_quota(account_id: str) -> dict:
    r = get_redis_client()
    if not r:
        return None
    try:
        data = r.get(f"codex_quota:{account_id}")
        if data:
            return json.loads(data)
    except Exception as e:
        print(f"Redis get error: {e}")
    return None

def set_cached_quota(account_id: str, quota_dict: dict, expire_seconds: int = 300):
    r = get_redis_client()
    if not r:
        return
    try:
        r.setex(
            f"codex_quota:{account_id}",
            expire_seconds,
            json.dumps(quota_dict)
        )
    except Exception as e:
        print(f"Redis set error: {e}")

def delete_cached_quota(account_id: str):
    r = get_redis_client()
    if not r:
        return
    try:
        r.delete(f"codex_quota:{account_id}")
    except Exception as e:
        print(f"Redis delete error: {e}")
