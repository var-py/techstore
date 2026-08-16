from sqlalchemy import create_engine, text

from .models import Base
from dotenv import dotenv_values
config=dotenv_values(".env")
engine = create_engine(config["AVAILABLE_URL"], isolation_level="AUTOCOMMIT")
with engine.connect() as connection:
    result = connection.execute(
    text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
    {"db_name": 'flask_db'}
    )

    database_exists = result.scalar()

    if not database_exists:
        connection.execute(text('CREATE DATABASE "flask_db"'))
        print("База данных flask_db создана")
    else:
        print("База данных flask_db уже существует")
engine = create_engine(config["AVAILABLE_URL"], echo=True)
# Base.metadata.create_all(bind=engine)
print(engine)