from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory


@pytest.mark.integration
def test_migrations_are_applied_before_tests(db_connection):
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    expected_head = ScriptDirectory.from_config(config).get_current_head()

    with db_connection.cursor() as cursor:
        cursor.execute("SELECT version_num FROM alembic_version")
        assert cursor.fetchone()[0] == expected_head

        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
        tables = {row[0] for row in cursor.fetchall()}
        assert {
            "admin", "code", "product", "users", "count_product",
            "messages", "order", "order_item",
        } <= tables

        # Эти столбцы добавлены последующими миграциями, а не начальной схемой.
        cursor.execute("SELECT created_at FROM users LIMIT 0")
        cursor.execute("SELECT urgency FROM product LIMIT 0")
