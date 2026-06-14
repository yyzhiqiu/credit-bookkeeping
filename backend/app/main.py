from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, accounts, records, mcp_router

from dotenv import load_dotenv

# 这会强制读取项目根目录下的 .env 文件
load_dotenv()
# Create all tables on startup
Base.metadata.create_all(bind=engine)

# Auto migrate schema for existing databases to add Codex API integration fields
from sqlalchemy import inspect, text
try:
    inspector = inspect(engine)
    if "accounts" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("accounts")]
        with engine.begin() as conn:
            if "api_type" not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN api_type VARCHAR(50) NULL"))
            if "api_url" not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN api_url VARCHAR(255) NULL"))
            if "api_key" not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN api_key TEXT NULL"))
            if "api_account_id" not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN api_account_id VARCHAR(100) NULL"))
            if "api_session_token" not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN api_session_token TEXT NULL"))
except Exception as e:
    import sys
    print(f"Error during schema migration: {e}", file=sys.stderr)


app = FastAPI(
    title="AI 额度记账 API",
    description="AI 账号额度消耗追踪记账系统后端服务",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境请限定为前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(records.router)
app.include_router(mcp_router.router)


@app.get("/", tags=["health"])
def health():
    return {"status": "ok", "service": "AI 额度记账 API v2"}
