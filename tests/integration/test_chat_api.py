
import json
from uuid import uuid4
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen
import pytest

from app.utils.security import hash_password


@pytest.mark.integration
def test_user_can_send_message(base_url, db_connection, chat_users):
    opener = build_opener(HTTPCookieProcessor())
    conn = db_connection
    cursor = conn.cursor()
    try:

        login_req = Request(
            f"{base_url}/login",
            data=json.dumps({"email": chat_users["sender_email"], "password": chat_users["password"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(login_req, timeout=10) as response:
            body = json.load(response)
            assert response.status == 200
            assert {"message": "True"} == body
        msg_req = Request(
            f"{base_url}/api/messages",
            data=json.dumps({"text": "Здравствуйте!", "to_user": chat_users["receiver_id"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(msg_req, timeout=10) as response:

            body = json.loads(response.read().decode())
            assert response.status == 200
            assert "id" in body

        cursor.execute(
            "SELECT text FROM messages WHERE from_user = %s AND to_user = %s",
            (chat_users["sender_id"], chat_users["receiver_id"])
        )
        saved_msg = cursor.fetchone()

        assert saved_msg is not None
        assert saved_msg[0] == "Здравствуйте!"

    finally:
        cursor.execute("DELETE FROM messages WHERE from_user = %s", (chat_users["sender_id"],))
        cursor.close()


@pytest.mark.integration
def test_sent_message_appears_in_chat(base_url, db_connection, chat_users):
    opener = build_opener(HTTPCookieProcessor())
    cursor = db_connection.cursor()

    try:
        login_req = Request(
            f"{base_url}/login",
            data=json.dumps({"email": chat_users["sender_email"], "password": chat_users["password"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(login_req, timeout=10) as response:
            assert response.status == 200

        msg_req = Request(
            f"{base_url}/api/messages",
            data=json.dumps({"text": "Тестовое сообщение", "to_user": chat_users["receiver_id"]}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with opener.open(msg_req, timeout=10) as response:
            assert response.status == 200

        chat_req = Request(
            f"{base_url}/api/chat/{chat_users['receiver_id']}",
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
        cursor.execute("DELETE FROM messages WHERE from_user = %s", (chat_users["sender_id"],))
        cursor.close()