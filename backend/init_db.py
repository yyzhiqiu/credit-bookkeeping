#!/usr/bin/env python3
"""
数据库初始化脚本
用法:
    python init_db.py                        # 创建表 + 创建默认用户
    python init_db.py --reset                # 删除所有表后重建（危险！）
    python init_db.py --user admin --pass 123456  # 指定用户名密码
"""
import argparse
import sys
import os

# 确保能正确 import app 模块
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal, Base
from app import models
from app.auth import hash_password


def create_tables(drop_first: bool = False):
    if drop_first:
        print("⚠️  正在删除所有表...")
        Base.metadata.drop_all(bind=engine)
        print("✅ 所有表已删除")
    print("📦 正在创建数据库表...")
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表创建完成")


def create_user(username: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.username == username).first()
        if existing:
            print(f"ℹ️  用户 '{username}' 已存在，跳过创建")
            return
        user = models.User(username=username, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        print(f"✅ 用户创建成功: {username}")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="AI 额度记账 - 数据库初始化")
    parser.add_argument("--reset", action="store_true", help="删除并重建所有表（危险！）")
    parser.add_argument("--user", default="admin", help="初始用户名 (默认: admin)")
    parser.add_argument("--pass", dest="password", default="codex2024", help="初始密码 (默认: codex2024)")
    args = parser.parse_args()

    if args.reset:
        confirm = input("⚠️  此操作将清空所有数据，确认继续？(输入 YES 继续): ")
        if confirm.strip() != "YES":
            print("已取消")
            return

    create_tables(drop_first=args.reset)
    create_user(args.user, args.password)

    print("\n🎉 初始化完成！")
    print(f"   用户名: {args.user}")
    print(f"   密  码: {args.password}")
    print(f"   请启动服务: uvicorn app.main:app --reload --port 8000")
    print(f"   API 文档: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
