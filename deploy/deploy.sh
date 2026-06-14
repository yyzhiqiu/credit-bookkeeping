#!/bin/bash

set -e

# ========================
# 目录与配置
# ========================
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$DEPLOY_DIR")"

BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

PORT=8000
APP_MODULE="app.main:app"
WORKERS=2
LOG_FILE="$BACKEND_DIR/backend.log"
VENV_DIR="$BACKEND_DIR/venv"
PYTHON="$VENV_DIR/bin/python"

echo "=============================="
echo "Full Stack Deploy Start"
echo "Root dir: $ROOT_DIR"
echo "=============================="

# ========================
# 前端构建
# ========================
echo "📦 Building frontend..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

npm run build

echo "✅ Frontend build completed. Output in $FRONTEND_DIR/dist"

# ========================
# 后端部署
# ========================
echo "📦 Setting up backend..."
cd "$BACKEND_DIR"

if [ ! -f "$PYTHON" ]; then
  echo "❌ 未找到虚拟环境：$VENV_DIR"
  echo "请先进入 backend 目录执行：python3 -m venv venv"
  exit 1
fi

if [ -f "requirements.txt" ]; then
  echo "Installing backend requirements..."
  "$PYTHON" -m pip install -r requirements.txt
fi

# ========================
# 释放端口
# ========================
OLD_PIDS=$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)

if [ -n "$OLD_PIDS" ]; then
  echo "⚠️ 发现端口 $PORT 被占用，准备停止旧进程：$OLD_PIDS"
  kill $OLD_PIDS || true
  sleep 2

  STILL_PIDS=$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)
  if [ -n "$STILL_PIDS" ]; then
    echo "⚠️ 旧进程未正常退出，强制 kill：$STILL_PIDS"
    kill -9 $STILL_PIDS || true
    sleep 1
  fi
else
  echo "✅ 端口 $PORT 未被占用"
fi

# ========================
# 启动服务
# ========================
echo "🚀 Starting backend..."

nohup "$PYTHON" -m uvicorn "$APP_MODULE" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers "$WORKERS" \
  > "$LOG_FILE" 2>&1 &

NEW_PID=$!

sleep 2

# ========================
# 检查启动结果
# ========================
RUNNING_PIDS=$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)

if [ -n "$RUNNING_PIDS" ]; then
  echo "✅ Backend started successfully"
  echo "PID: $RUNNING_PIDS"
  echo "API URL: http://127.0.0.1:$PORT"
  echo "Log: $LOG_FILE"
else
  echo "❌ Backend 启动失败，请查看日志："
  echo "tail -n 100 $LOG_FILE"
  exit 1
fi

echo "=============================="
echo "🎉 Deploy finished successfully!"
echo "前端静态文件请通过 Nginx 或其他方式代理 $FRONTEND_DIR/dist 目录"
echo "后端服务已在后台运行 (端口: $PORT)"
echo "=============================="
