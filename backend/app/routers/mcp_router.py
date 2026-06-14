import anyio
from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session
from mcp.server.sse import SseServerTransport

from ..database import get_db
from .. import models
from ..auth import verify_password
from ..mcp_server import mcp_server, mcp_user_id
import logging

router = APIRouter(prefix="/mcp", tags=["mcp"])

sse = SseServerTransport("/api/mcp/messages")
security = HTTPBasic()

def authenticate_mcp(credentials: HTTPBasicCredentials = Depends(security), db: Session = Depends(get_db)) -> models.User:
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return user

@router.get("/sse")
async def handle_sse(request: Request, user: models.User = Depends(authenticate_mcp)):
    """MCP SSE endpoint for establishing the connection"""
    # Bind the authenticated user to the current asyncio task's context
    mcp_user_id.set(user.id)
    
    # The MCP SDK uses an async context manager that yields (read_stream, write_stream)
    async with sse.connect_sse(request.scope, request.receive, request.send) as streams:
        # Run the server with this transport
        await mcp_server.run(
            streams[0],
            streams[1],
            mcp_server.create_initialization_options()
        )


@router.post("/messages")
async def handle_messages(request: Request, user: models.User = Depends(authenticate_mcp)):
    """MCP messages endpoint for receiving JSON-RPC messages"""
    # Also bind here just in case, though the actual tool runs in the GET /sse task
    mcp_user_id.set(user.id)
    await sse.handle_post_message(request.scope, request.receive, request.send)

