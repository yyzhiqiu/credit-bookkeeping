import asyncio
import argparse
import sys
from mcp.server.stdio import stdio_server
from app.mcp_server import mcp_server, mcp_user_id
from app.database import SessionLocal
from app import models
from app.auth import verify_password

async def main():
    parser = argparse.ArgumentParser(description="MCP Stdio Server for Credit Bookkeeping")
    parser.add_argument("--username", required=True, help="User's username for authentication")
    parser.add_argument("--password", required=True, help="User's password for authentication")
    args = parser.parse_args()

    # Authenticate and set context
    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.username == args.username).first()
        if not user or not verify_password(args.password, user.password_hash):
            print("Error: Invalid username or password", file=sys.stderr)
            sys.exit(1)
        mcp_user_id.set(user.id)

    # Start the server
    async with stdio_server() as (read_stream, write_stream):
        await mcp_server.run(
            read_stream,
            write_stream,
            mcp_server.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())

