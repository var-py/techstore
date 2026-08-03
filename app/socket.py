
import datetime

from flask_socketio import SocketIO
from flask_socketio import emit,join_room,leave_room
from flask import Flask, jsonify, render_template, request, abort, session as session_login, redirect
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import update


from app.DB.models import Users, Admin
from app.DB.session import engine

socketio = SocketIO(cors_allowed_origins="*")

@socketio.on("connect")
def handle_connect():
    user_id = session_login.get("user_id")
    print("CONNECTED", user_id)
    if user_id is None:
        return
    with Session(engine) as session:
        qqq = update(Users).values(status=True).where(Users.id == user_id)
        session.execute(qqq)
        session.commit()
        emit("user_status", {"user_id": user_id, "status": True}, broadcast=True)
        name_u = select(Users).where(Users.id == user_id)
        userconn = session.scalar(name_u)
        if userconn is not None:
            join_room("users")
            socketio.emit("user_connect", {"user_id": user_id, "user_status": True},
                          to=str("admins"))
            join_room(str(user_id))
        name = select(Admin).where(Admin.user_id == user_id)
        admin = session.scalar(name)
        if admin is not None:
            join_room("admins")
@socketio.on("disconnect")
def handle_disconnect():
    user_id = session_login.get("user_id")
    print("DISCONNECTED", user_id)
    if user_id is None:
        return
    with Session(engine) as session:
        qqq = update(Users).values(status=False).where(Users.id == user_id)
        session.execute(qqq)
        session.commit()
        emit("user_status", {"user_id": user_id, "status": False}, broadcast=True)
        name_u = select(Users).where(Users.id == user_id)
        userconn = session.scalar(name_u)
        if userconn is not None:
            leave_room("users")
            socketio.emit("user_disconnect", {"user_id": user_id, "user_status": False},
                          to=str("admins"))
            leave_room(str(user_id))
        name = select(Admin).where(Admin.user_id == user_id)
        admin = session.scalar(name)
        if admin is not None:
            leave_room("admins")