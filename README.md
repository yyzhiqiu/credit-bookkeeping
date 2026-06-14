# AI 额度记账

AI 账号额度消耗追踪工具，支持多用户、多账号、充值周期管理与逆推重算。

## 业务规则

- `配置周数` 只用于确定该周期的周预算基线，例如充值 140 元、配置 4 周，则周预算为 35 元。
- `业务周` 允许超过配置周数，用来适配官方手动刷新额度、补发额度等情况。
- 当出现第 5 周、第 6 周这类超配置周时，系统不会回头改动前面 4 周的预算，而是继续沿用当前周期的周预算记账。
- 当前业务周会取“自然流逝到的周数”和“已记录到的最大业务周”两者中的较大值，避免手动推进后界面仍停留在旧周。

## 技术栈

| 层     | 技术                              |
|--------|-----------------------------------|
| 后端   | Python 3.11+, FastAPI, SQLAlchemy |
| 数据库 | MySQL 8.0+                        |
| 前端   | React 18, Vite, Tailwind CSS      |

---

## 目录结构

```
credit_bookkeeping/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 入口
│   │   ├── models.py        # SQLAlchemy ORM 模型
│   │   ├── schemas.py       # Pydantic 请求/响应模型
│   │   ├── auth.py          # JWT 鉴权工具
│   │   ├── engine.py        # 逆推重算引擎
│   │   ├── config.py        # 配置（读取 .env）
│   │   ├── database.py      # DB 连接
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── accounts.py  # 账号 + 仪表盘
│   │       └── records.py   # 流水 + CSV 导出
│   ├── init_db.py           # 数据库初始化脚本
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/client.js    # Axios API 封装
    │   └── components/
    │       ├── Login.jsx
    │       ├── Dashboard.jsx
    │       ├── AccountsManager.jsx
    │       └── RecordsManager.jsx
    └── package.json
```

---

## 快速启动

### 1. 准备 MySQL 数据库

```sql
CREATE DATABASE credit_bookkeeping CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置后端环境

```bash
cd backend

# 复制并修改环境变量
cp .env.example .env
```

编辑 `.env`：

```ini
DATABASE_URL=mysql+pymysql://你的用户名:你的密码@localhost:3306/credit_bookkeeping
SECRET_KEY=随机字符串（越长越安全）
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 3. 安装后端依赖

```bash
# 建议使用虚拟环境
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/macOS

pip install -r requirements.txt
```

### 4. 初始化数据库 & 创建用户

```bash
# 默认用户名 admin，密码 codex2024
python init_db.py

# 自定义用户名密码
python init_db.py --user myname --pass mypassword

# 重置数据库（危险！清空所有数据）
python init_db.py --reset
```

### 5. 启动后端服务

```bash
uvicorn app.main:app --reload --port 8000
# 静默启动
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 > backend.log 2>&1 &
```

- API 文档（Swagger）：http://localhost:8000/docs
- 交互式文档（ReDoc）：http://localhost:8000/redoc

### 6. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 7. 启动前端开发服务

```bash
npm run dev
```

访问：http://localhost:3000

---

## 🤖 MCP (Model Context Protocol) 接入

本项目原生集成了官方的 MCP 服务，让您的 AI 智能体（Agent）可以全自动地查额度并记账。无论您使用哪种框架（LangGraph, AutoGen，或是 Claude Desktop 等桌面端），只要您的 Agent 支持 MCP 协议，均可直接对接本系统的能力。

### 暴露的 MCP Tools
1. `get_accounts_summary`: 获取系统中当前可用的活跃账号列表、名称以及本地剩余额度。
2. `check_online_quota`: 实时调用 Codex 接口，查询指定账号的线上真实剩余额度。
3. `sync_and_record_expense` (🌟核心工具): 智能体在干完活后调用此工具，传入 `account_id` 和工作日记 `description`。系统会自动比对线上额度、计算本次消耗差值、完成数据库记账，并自动更新周累计数据。

### 接入方式
系统提供两种维度的通信接口，可根据您的智能体运行环境灵活选择。**请注意，所有的请求都必须进行身份验证，以保障额度和流水的安全隔离。**

**方式一：HTTP SSE (Server-Sent Events) 接入（推荐）**
随 FastAPI 后端默认启动，适用于支持 HTTP 远程调用的 Agent。
* **Endpoint URL**: `http://localhost:8000/mcp/sse`
* **鉴权方式**: HTTP Basic Auth。您需要在智能体配置中，将 `Authorization: Basic <base64编码的用户名:密码>` 加到请求 Header 里。

**方式二：Stdio 标准输入输出接入**
适用于 Claude Desktop、Cursor 等桌面级 Agent 客户端。
在您的客户端配置文件（如 `mcp.json`）中添加以下配置（通过 `--username` 和 `--password` 传递登录凭证）：
```json
{
  "mcpServers": {
    "credit-bookkeeping": {
      "command": "/绝对路径/到/您的/backend/venv/bin/python",
      "args": [
        "/绝对路径/到/您的/backend/mcp_stdio_main.py",
        "--username",
        "您的用户名",
        "--password",
        "您的密码"
      ]
    }
  }
}
```

---

## API 说明

### 鉴权

所有接口（除 `/api/auth/login`）需在 Header 中携带：

```
Authorization: Bearer <token>
```

登录后 token 默认有效期 **24 小时**。

### 主要接口

| 方法   | 路径                              | 说明                         |
|--------|-----------------------------------|------------------------------|
| POST   | `/api/auth/login`                 | 登录，返回 JWT               |
| GET    | `/api/auth/me`                    | 获取当前用户信息              |
| GET    | `/api/accounts`                   | 获取账号列表（含活跃周期）    |
| POST   | `/api/accounts`                   | 新建账号（自动创建第1期）     |
| PATCH  | `/api/accounts/{id}`              | 修改账号名称/状态            |
| DELETE | `/api/accounts/{id}`              | 删除账号（级联删除）          |
| GET    | `/api/accounts/{id}/delete-info`  | 删除前预览影响范围            |
| POST   | `/api/accounts/{id}/recharge`     | 续费（归档当前期，开启新期）  |
| GET    | `/api/accounts/dashboard/summary` | 总览统计数据                  |
| GET    | `/api/records`                    | 获取流水列表（支持筛选）      |
| POST   | `/api/records`                    | 新增消耗记录（自动重算）      |
| PATCH  | `/api/records/{id}`               | 修改记录（触发级联重算）      |
| DELETE | `/api/records/{id}`               | 删除记录（触发级联重算）      |
| GET    | `/api/records/export/csv`         | 导出 CSV（支持按账号筛选）    |

---

## 常见问题

**Q: 密码忘了怎么办？**

```bash
# 重置整个数据库并重新创建用户（会清空数据！）
python init_db.py --reset --user admin --pass 新密码

# 或者：直接在数据库中更新密码哈希（需要用脚本生成哈希值）
python -c "from app.auth import hash_password; print(hash_password('新密码'))"
```

**Q: 前端报 403 / 401 错误？**

检查 `.env` 中的 `SECRET_KEY` 是否与生成 token 时一致，修改后需重新登录。

**Q: 跨域报错？**

开发环境下，Vite 的 proxy 会将 `/api` 转发到 `localhost:8000`，无需额外配置。  
生产部署时，请配置 Nginx 反向代理或修改 `main.py` 中的 `allow_origins`。

---

## 生产部署建议

```bash
# 后端（无 --reload）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

# 前端构建
npm run build
# 将 dist/ 目录部署到 Nginx/静态服务器
```
