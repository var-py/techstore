"""Создать таблицы в одноразовой тестовой базе, не импортируя приложение."""
import os

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from app.DB.models import Base


url = os.environ["TEST_DATABASE_URL"]
if make_url(url).database != "flask_db_test":
    raise RuntimeError("Создание таблиц разрешено только в flask_db_test")

engine = create_engine(url)
try:
    Base.metadata.create_all(engine)
finally:
    engine.dispose()