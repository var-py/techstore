import datetime
import os
from pathlib import Path
from uuid import uuid4

import psycopg2
import pytest
from psycopg2.extensions import parse_dsn

from app.utils.security import hash_password
from dotenv import load_dotenv
from alembic import command
from alembic.config import Config

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

# @pytest.fixture(scope="session", autouse=True)
# def apply_migrations(database_url):
#     config = Config(str(PROJECT_ROOT / "alembic.ini"))
#     config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
#     command.upgrade(config, "head")
@pytest.fixture
def base_url():
    url = os.getenv("TEST_BASE_URL")
    if not url:
        pytest.fail("Задайте TEST_BASE_URL или запустите make test", pytrace=False)
    return url.rstrip("/")
@pytest.fixture(scope="session")
def database_url():
    url = os.getenv("TEST_DATABASE_URL")
    if not url or parse_dsn(url).get("dbname") != "flask_db_test":
        pytest.fail(
            "TEST_DATABASE_URL должен указывать на flask_db_test. Запустите make test.",
            pytrace=False,
        )
    return url
@pytest.fixture
def db_connection(database_url):
    connection = psycopg2.connect(database_url, connect_timeout=5)
    connection.autocommit = True
    try:
        yield connection
    finally:
        connection.close()

@pytest.fixture
def chat_users(db_connection):
    email1 = f"{uuid4()}@mail.ru"
    email2 = f"{uuid4()}@mail.ru"
    password = 'qwerty12'
    pswd = hash_password(password)
    conn = db_connection
    cursor = conn.cursor()

    try:
        cursor.execute(
            "INSERT INTO users (name, email, password, status, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            ("User1", email1, pswd, False, datetime.datetime.now()))
        user1_id = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO users (name, email, password, status, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            ("User2", email2, pswd, False, datetime.datetime.now()))
        user2_id = cursor.fetchone()[0]
        yield {
            "sender_id": user1_id,
            "receiver_id": user2_id,
            "sender_email": email1,
            "receiver_email": email2,
            "password": password,
        }
    finally:
        cursor.execute("DELETE FROM users WHERE email IN (%s, %s)", (email1, email2))
        cursor.close()
        conn.close()
