from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, accounts, records

from dotenv import load_dotenv

# 这会强制读取项目根目录下的 .env 文件
load_dotenv()
# Create all tables on startup
Base.metadata.create_all(bind=engine)

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


@app.get("/", tags=["health"])
def health():
    return {"status": "ok", "service": "AI 额度记账 API v2"}
