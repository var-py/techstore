"""Создать таблицы в одноразовой тестовой базе, не импортируя приложение."""
import os

from sqlalchemy.engine import make_url

from app.migrate import upgrade_database


url = os.environ["TEST_DATABASE_URL"]
if make_url(url).database != "flask_db_test":
    raise RuntimeError("Создание таблиц разрешено только в flask_db_test")

upgrade_database(url)
