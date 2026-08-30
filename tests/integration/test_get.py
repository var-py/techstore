import json
from http.cookiejar import CookieJar
from uuid import uuid4
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen

import psycopg2
import pytest

@pytest.mark.integration
def test_user_can_log_in():
    email=f"{uuid4()}@mail.ru"
    pswd=f"{uuid4()}"
    try:
        registration = Request(
            f"http://localhost/registration",
            data=json.dumps(
                {"name": "Test User",
                 "email": email,
                 "password": pswd}
            ).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(registration, timeout=10) as response:
            assert response.status == 200
        try:
            cookies = CookieJar()
            client = build_opener(HTTPCookieProcessor(cookies))
            login = Request(f"http://localhost/login",
                            data=json.dumps(
                                {"name": "Test User",
                                 "email": email,
                                 "password": pswd}
                            ).encode(),
                            headers={"Content-Type": "application/json"},
                            method="POST", )
            with client.open(login, timeout=10) as response:
                body = json.load(response)
                assert response.status == 200
                assert {"message": "True"} == body
        finally:
            pass
        try:
            account= Request(f"http://localhost/account",
                             method="GET",)
            with client.open(account, timeout=10) as response:
                page = response.read().decode()
                assert response.status == 200
                assert "Личный кабинет" in page
        finally:
            pass
    finally:
        DATABASE_URL = "postgresql://flask_user:flask_password@localhost:5433/postgres"
        connection = psycopg2.connect(DATABASE_URL)
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE email = %s", (email,))
        connection.close()