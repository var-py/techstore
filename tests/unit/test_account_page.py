"""Страница кабинета: шаблон, стили и связка с account.js.

Тесты быстрые и не требуют базы данных: шаблон рендерится минимальным
Flask-приложением, а account.js проверяется как текст.
"""
import re
from pathlib import Path

import pytest
from flask import Flask

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = PROJECT_ROOT / "app" / "templates"
STATIC = PROJECT_ROOT / "app" / "static"

ACCOUNT_JS = STATIC / "js" / "account.js"
ACCOUNT_CSS = STATIC / "css" / "account.css"

# Идентификаторы, которые account.js ищет через `$('#...')`.
JS_ID_PATTERN = re.compile(r"['\"`]#([A-Za-z][A-Za-z0-9_-]*)")


@pytest.fixture(scope="module")
def account_html():
    app = Flask(__name__, template_folder=str(TEMPLATES), static_folder=str(STATIC))
    with app.test_request_context("/account"):
        from flask import render_template

        return render_template(
            "account.html",
            name="Варвара Просвирякова",
            email="varar666@mail.ru",
            user_id=1,
            created_at="2026-10-04 12:30:00",
        )


def test_page_has_all_sections(account_html):
    for section in ("profile", "orders", "addresses", "favorites", "reviews", "settings"):
        assert f'id="section-{section}"' in account_html
        assert f'data-section="{section}"' in account_html


def test_page_loads_styles_and_scripts(account_html):
    assert "/static/css/account.css" in account_html
    assert "/static/js/account.js" in account_html
    assert "font-awesome" in account_html
    assert "socket.io" in account_html


def test_user_values_are_rendered(account_html):
    assert "Варвара Просвирякова" in account_html
    assert "varar666@mail.ru" in account_html
    assert "#1" in account_html


def test_every_js_selector_exists_in_html(account_html):
    html_ids = set(re.findall(r'id="([^"]+)"', account_html))
    js_ids = set(JS_ID_PATTERN.findall(ACCOUNT_JS.read_text(encoding="utf-8")))

    assert js_ids, "не найдено ни одного селектора в account.js"
    missing = sorted(js_ids - html_ids)
    assert not missing, f"account.js ссылается на отсутствующие id: {missing}"


def test_classes_used_by_js_are_declared_in_css():
    css = ACCOUNT_CSS.read_text(encoding="utf-8")
    for class_name in (
        "hidden",
        "toast",
        "empty-state",
        "skeleton",
        "nav-item",
        "order-card",
        "address-card",
        "product-card",
        "review-card",
        "stars-input",
        "switch",
        "chat-window",
        "badge",
        "stat-card",
    ):
        assert f".{class_name}" in css, f"в account.css нет стилей для .{class_name}"


def test_css_keeps_nested_forms_usable_on_mobile():
    css = ACCOUNT_CSS.read_text(encoding="utf-8")
    assert "@media (max-width: 1024px)" in css
    assert "@media (max-width: 720px)" in css
    assert "position: sticky" in css


def test_js_is_isolated_and_escapes_server_data():
    """Скрипт не течёт в глобальную область и экранирует данные с сервера."""
    source = ACCOUNT_JS.read_text(encoding="utf-8")
    assert "(() => {" in source
    assert source.rstrip().endswith("})();")
    assert "'use strict';" in source
    # Все данные из API вставляются в разметку через escapeHtml.
    assert source.count("escapeHtml(") >= 25
    assert "document.write" not in source
