import json
import os
from urllib.error import HTTPError
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
            login = Request(f"http://localhost/login",
                            data=json.dumps(
                                {"name": "Test User",
                                 "email": email,
                                 "password": "fsafkjhf"}
                            ).encode(),
                            headers={"Content-Type": "application/json"},
                            method="POST", )
            with urlopen(login, timeout=10) as response:
                body = json.load(response)
                assert response.status == 401
                assert {"message": "True"} != body
                assert response.reason == "неверный логин или пароль!"
        except HTTPError as error:
            assert error.code == 401
            response_text = error.read().decode()
            assert "неверный логин или пароль!" in response_text
        finally:
            pass
    finally:
        DATABASE_URL = os.getenv("TEST_DATABASE_URL")
        connection = psycopg2.connect(DATABASE_URL)
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE email = %s", (email,))
        connection.close()