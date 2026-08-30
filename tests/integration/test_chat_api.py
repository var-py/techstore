import datetime
import json
from uuid import uuid4
from urllib.request import HTTPCookieProcessor, Request, build_opener
import psycopg2
import pytest
from urllib.error import HTTPError

from app.utils.security import hash_password

DATABASE_URL = "postgresql://flask_user:flask_password@localhost:5433/postgres"

def get_db_connection():
    connection = psycopg2.connect(DATABASE_URL)
    connection.autocommit = True
    return connection


@pytest.mark.integration
def test_user_can_send_message(base_url, db_connection, chat_users):
    opener = build_opener(HTTPCookieProcessor())
    conn = db_connection
    cursor = conn.cursor()
    try:
        login_req = Request(
            "http://localhost/login",
            data=json.dumps({"email": chat_users["sender_email"], "password": chat_users["password"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(login_req, timeout=10) as response:
            assert response.status == 200

        msg_req = Request(
            "http://localhost/api/messages",
            data=json.dumps({"text": "Здравствуйте!", "to_user": chat_users["receiver_id"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(msg_req, timeout=10) as response:
            assert response.status == 200
            body = json.loads(response.read().decode())
            assert "id" in body

        cursor.execute("SELECT text FROM messages WHERE from_user = %s AND to_user = %s",  (chat_users["sender_email"], chat_users["receiver_id"]))
        saved_msg = cursor.fetchone()
        assert saved_msg is not None
        assert saved_msg[0] == "Здравствуйте!"

    finally:
        cursor.execute("DELETE FROM messages WHERE from_user = %s", (chat_users["sender_email"],))
        cursor.close()
        conn.close()


@pytest.mark.integration
def test_sent_message_appears_in_chat():
    email1 = f"{uuid4()}@mail.ru"
    email2 = f"{uuid4()}@mail.ru"
    password = 'qwerty12'
    pswd= hash_password(password)
    opener = build_opener(HTTPCookieProcessor())
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("INSERT INTO users (name, email, password, status, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                       ("User1", email1, pswd, False, datetime.datetime.now()))
        user1_id = cursor.fetchone()[0]
        cursor.execute("INSERT INTO users (name, email, password, status, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                       ("User2", email2, pswd, False, datetime.datetime.now()))
        user2_id = cursor.fetchone()[0]

        login_req = Request(
            "http://localhost/login",
            data=json.dumps({"email": email1, "password": password}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(login_req, timeout=10) as response:
            assert response.status == 200

        msg_req = Request(
            "http://localhost/api/messages",
            data=json.dumps({"text": "Тестовое сообщение", "to_user": user2_id}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(msg_req, timeout=10) as response:
            assert response.status == 200

        chat_req = Request(
            f"http://localhost/api/chat/{user2_id}",
            headers={"Content-Type": "application/json"},
            method="GET",
        )
        with opener.open(chat_req, timeout=10) as response:
            assert response.status == 200
            chat_data = json.loads(response.read().decode())

            assert len(chat_data) > 0
            assert chat_data[-1]["text"] == "Тестовое сообщение"
            assert chat_data[-1]["sender"] == "admin"

    finally:
        cursor.execute("DELETE FROM messages WHERE from_user = %s", (user1_id,))
        cursor.execute("DELETE FROM users WHERE email IN (%s, %s)", (email1, email2))
        cursor.close()
        conn.close()