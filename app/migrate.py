"""Apply the versioned schema to the same database used by the application."""
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from dotenv import dotenv_values
from sqlalchemy import create_engine


def upgrade_database(url: str) -> None:
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
    finally:
        engine.dispose()


if __name__ == "__main__":
    values = dotenv_values(".env")
    upgrade_database(os.environ.get("POSTGRESS_URL") or values["POSTGRESS_URL"])
