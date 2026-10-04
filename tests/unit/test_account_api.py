"""Тесты API личного кабинета.

Тесты работают на SQLite: до импорта приложения модуль ``app.DB.session``
подменяется заглушкой, поэтому Postgres, Redis и Kafka не нужны, а сеть
не используется совсем.
"""
import importlib
import sys
import types
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.DB.models import (
    Address,
    Admin,
    Base,
    Favorite,
    Messages,
    Order,
    Order_item,
    Product,
    Review,
    Users,
)
from app.utils.security import hash_password

STUBBED_MODULES = (
    "app.main",
    "app.routes",
    "app.account_api",
    "app.socket",
    "app.work_celery",
    "app.DB.session",
)


@pytest.fixture(scope="module")
def flask_app():
    """Flask-приложение на одноразовой базе SQLite в памяти."""
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    for name in STUBBED_MODULES:
        sys.modules.pop(name, None)

    import app.DB

    stub = types.ModuleType("app.DB.session")
    stub.engine = engine
    stub.config = {
        "SESSION_A": "test-secret-key",
        "CELERY_BROKER_URL": "memory://",
        "CELERY_RESULT_BACKEND": "cache+memory://",
        "PASSWORD_MAIL": "",
        "POSTGRESS_URL": "",
        "POSTGRESS_POSTGRES_URL": "",
    }
    sys.modules["app.DB.session"] = stub
    setattr(app.DB, "session", stub)

    Base.metadata.create_all(engine)

    main = importlib.import_module("app.main")
    main.app.config.update(TESTING=True)
    yield main.app, engine


@pytest.fixture
def user(flask_app):
    """Авторизованный клиент вместе с id созданного пользователя."""
    app, engine = flask_app
    email = f"{uuid4()}@mail.ru"
    password = "qwerty12"
    with app.test_client() as client:
        response = client.post(
            "/registration",
            json={"name": "Иван Иванов", "email": email, "password": password},
        )
        assert response.status_code == 200, response.get_data(as_text=True)
        with Session(engine) as session:
            created = session.scalar(select(Users).where(Users.email == email))
            user_id = created.id
        yield {
            "client": client,
            "id": user_id,
            "email": email,
            "password": password,
            "engine": engine,
        }


@pytest.fixture
def product(flask_app):
    app, engine = flask_app
    with Session(engine) as session:
        item = Product(
            title=f"Смартфон {uuid4().hex[:6]}",
            price="89 999 ₽",
            photo="https://example.com/phone.png",
            description="Описание",
            category="Смартфоны",
            brand="Samsung",
        )
        session.add(item)
        session.commit()
        return item.id


# --------------------------------------------------------------------------- #
# Доступ
# --------------------------------------------------------------------------- #
def test_api_requires_login(flask_app):
    app, _ = flask_app
    with app.test_client() as anon:
        response = anon.get("/api/account/profile")
        assert response.status_code == 401
        assert response.get_json()["error"]

        page = anon.get("/account")
        assert page.status_code == 302
        assert "/login" in page.headers["Location"]


def test_account_page_renders_all_sections(flask_app, user):
    response = user["client"].get("/account")
    body = response.get_data(as_text=True)
    assert response.status_code == 200
    assert "Иван Иванов" in body
    for section in ("profile", "orders", "addresses", "favorites", "reviews", "settings"):
        assert f'id="section-{section}"' in body
    assert "/static/js/account.js" in body
    assert "/static/css/account.css" in body


# --------------------------------------------------------------------------- #
# Личные данные
# --------------------------------------------------------------------------- #
def test_profile_is_returned_with_stats(user):
    payload = user["client"].get("/api/account/profile").get_json()
    assert payload["user"]["email"] == user["email"]
    assert payload["stats"] == {
        "orders": 0,
        "favorites": 0,
        "reviews": 0,
        "addresses": 0,
        "unread_messages": 0,
    }


def test_profile_can_be_updated(user):
    client = user["client"]
    new_email = f"{uuid4()}@mail.ru"
    response = client.put("/api/account/profile", json={"name": "Пётр Петров", "email": new_email})
    assert response.status_code == 200
    assert response.get_json()["user"]["name"] == "Пётр Петров"

    assert client.get("/api/account/profile").get_json()["user"]["email"] == new_email


@pytest.mark.parametrize(
    "body, expected",
    [
        ({"name": "", "email": "a@b.ru"}, 400),
        ({"name": "Имя", "email": "не-почта"}, 400),
    ],
)
def test_profile_validation(user, body, expected):
    response = user["client"].put("/api/account/profile", json=body)
    assert response.status_code == expected
    assert response.get_json()["error"]


def test_profile_email_must_be_unique(flask_app, user):
    app, engine = flask_app
    other_email = f"{uuid4()}@mail.ru"
    with Session(engine) as session:
        session.add(
            Users(name="Другой", email=other_email, password=hash_password("qwerty12"), status=False)
        )
        session.commit()

    response = user["client"].put(
        "/api/account/profile", json={"name": "Иван Иванов", "email": other_email.upper()}
    )
    assert response.status_code == 409


def test_password_change_flow(user):
    client = user["client"]
    assert client.post(
        "/api/account/password",
        json={"current_password": "неверный", "new_password": "newpass123", "confirm_password": "newpass123"},
    ).status_code == 400
    assert client.post(
        "/api/account/password",
        json={"current_password": user["password"], "new_password": "newpass123", "confirm_password": "другой"},
    ).status_code == 400
    assert client.post(
        "/api/account/password",
        json={"current_password": user["password"], "new_password": "short", "confirm_password": "short"},
    ).status_code == 400

    assert client.post(
        "/api/account/password",
        json={"current_password": user["password"], "new_password": "newpass123", "confirm_password": "newpass123"},
    ).status_code == 200

    with user["engine"].connect() as connection:
        stored = connection.execute(
            select(Users.password).where(Users.email == user["email"])
        ).scalar()
    from app.utils.security import verify_password

    assert verify_password("newpass123", stored) is True


# --------------------------------------------------------------------------- #
# Заказы
# --------------------------------------------------------------------------- #
def test_orders_can_be_created_and_listed(user, product):
    client = user["client"]
    created = client.post("/api/account/orders", json={"product_id": product, "qty": 2})
    assert created.status_code == 201
    order = created.get_json()
    assert order["items_count"] == 2
    assert order["total"] == 179998.0
    assert order["status_label"] == "В обработке"
    assert order["items"][0]["title"].startswith("Смартфон")

    listed = client.get("/api/account/orders").get_json()
    assert [item["id"] for item in listed] == [order["id"]]
    assert listed[0]["number"] == f"{order['id']:06d}"

    with Session(user["engine"]) as session:
        rows = session.scalars(select(Order_item).where(Order_item.order_id == order["id"])).all()
        assert len(rows) == 1
        assert rows[0].price_at_purchase == 89999.0


def test_order_with_unknown_product_returns_404(user):
    response = user["client"].post("/api/account/orders", json={"product_id": 999999})
    assert response.status_code == 404


def test_order_can_reuse_address(user, product):
    client = user["client"]
    address = client.post(
        "/api/account/addresses",
        json={
            "recipient": "Иван Иванов",
            "phone": "+7 900 000-00-00",
            "city": "Москва",
            "street": "Тверская",
            "house": "15",
        },
    ).get_json()

    order = client.post(
        "/api/account/orders", json={"product_id": product, "qty": 1, "address_id": address["id"]}
    ).get_json()
    assert order["address"]["full"] == "Москва, Тверская, д. 15"
    assert order["total"] == 89999.0


def test_order_can_be_repeated(user, product):
    client = user["client"]
    order = client.post("/api/account/orders", json={"product_id": product, "qty": 3}).get_json()
    repeated = client.post(f"/api/account/orders/{order['id']}/repeat")
    assert repeated.status_code == 201
    assert repeated.get_json()["id"] != order["id"]
    assert repeated.get_json()["items_count"] == 3


def test_order_done_page_creates_order(flask_app, user, product, monkeypatch):
    app, engine = flask_app
    from app import routes

    sent = []
    monkeypatch.setattr(routes, "send_ask_inventory", lambda event: sent.append(event))

    response = user["client"].get(f"/order/done?product_id={product}&qty=2")
    assert response.status_code == 200
    assert sent and sent[0]["product_id"] == product
    assert sent[0]["order_id"] == sent[0]["order_id"]

    with Session(engine) as session:
        orders = session.scalars(select(Order).where(Order.user_id == user["id"])).all()
        assert len(orders) == 1
        assert str(orders[0].id) in response.get_data(as_text=True)


# --------------------------------------------------------------------------- #
# Адреса доставки
# --------------------------------------------------------------------------- #
def test_addresses_crud(user):
    client = user["client"]
    base = {
        "recipient": "Иван Иванов",
        "phone": "+7 900 000-00-00",
        "city": "Москва",
        "street": "Тверская",
        "house": "15",
    }

    first = client.post("/api/account/addresses", json=base)
    assert first.status_code == 201
    first = first.get_json()
    assert first["is_default"] is True  # первый адрес становится основным
    assert first["full"] == "Москва, Тверская, д. 15"

    second = client.post(
        "/api/account/addresses", json={**base, "city": "Казань", "apartment": "42", "postcode": "420000"}
    ).get_json()
    assert second["is_default"] is False

    assert client.post(f"/api/account/addresses/{second['id']}/default").status_code == 200
    listed = client.get("/api/account/addresses").get_json()
    assert [item["id"] for item in listed] == [second["id"], first["id"]]
    assert listed[0]["is_default"] is True
    assert listed[1]["is_default"] is False
    assert "кв. 42" in listed[0]["full"]

    updated = client.put(
        f"/api/account/addresses/{first['id']}", json={**base, "street": "Арбат", "comment": "Домофон 12"}
    )
    assert updated.status_code == 200
    assert updated.get_json()["street"] == "Арбат"
    assert updated.get_json()["comment"] == "Домофон 12"

    # удаление основного адреса передаёт статус оставшемуся
    assert client.delete(f"/api/account/addresses/{second['id']}").status_code == 200
    remaining = client.get("/api/account/addresses").get_json()
    assert len(remaining) == 1
    assert remaining[0]["is_default"] is True


def test_address_requires_required_fields(user):
    response = user["client"].post("/api/account/addresses", json={"recipient": "Иван"})
    assert response.status_code == 400
    assert "обязательные" in response.get_json()["error"]


def test_address_of_another_user_is_hidden(flask_app, user):
    app, engine = flask_app
    stranger_email = f"{uuid4()}@mail.ru"
    with Session(engine) as session:
        stranger = Users(
            name="Чужой", email=stranger_email, password=hash_password("qwerty12"), status=False
        )
        session.add(stranger)
        session.flush()
        address = Address(
            user_id=stranger.id,
            recipient="Чужой",
            phone="+7 000",
            city="Сочи",
            street="Морская",
            house="1",
            is_default=True,
            created_at="2026-10-04T12:00:00+00:00",
        )
        session.add(address)
        session.commit()
        address_id = address.id

    client = user["client"]
    assert client.get("/api/account/addresses").get_json() == []
    assert client.delete(f"/api/account/addresses/{address_id}").status_code == 404
    assert client.post(f"/api/account/addresses/{address_id}/default").status_code == 404


# --------------------------------------------------------------------------- #
# Избранное
# --------------------------------------------------------------------------- #
def test_favorites_flow(user, product):
    client = user["client"]
    added = client.post("/api/account/favorites", json={"product_id": product})
    assert added.status_code == 201
    assert added.get_json()["added"] is True

    again = client.post("/api/account/favorites", json={"product_id": product})
    assert again.status_code == 200
    assert again.get_json()["added"] is False

    listed = client.get("/api/account/favorites").get_json()
    assert len(listed) == 1
    assert listed[0]["id"] == product
    assert listed[0]["price"] == 89999.0
    assert listed[0]["url"] == f"/product/{product}"

    assert client.get("/api/account/profile").get_json()["stats"]["favorites"] == 1

    assert client.delete(f"/api/account/favorites/{product}").status_code == 200
    assert client.get("/api/account/favorites").get_json() == []
    assert client.delete(f"/api/account/favorites/{product}").status_code == 404


def test_favorite_unknown_product(user):
    response = user["client"].post("/api/account/favorites", json={"product_id": 999999})
    assert response.status_code == 404


# --------------------------------------------------------------------------- #
# Отзывы
# --------------------------------------------------------------------------- #
def test_reviews_crud(user, product):
    client = user["client"]
    created = client.post(
        "/api/account/reviews", json={"product_id": product, "rating": 4, "text": "Хороший телефон, но тяжёлый."}
    )
    assert created.status_code == 201
    review = created.get_json()
    assert review["rating"] == 4
    assert review["product_id"] == product
    assert review["product_title"].startswith("Смартфон")

    duplicate = client.post(
        "/api/account/reviews", json={"product_id": product, "rating": 5, "text": "Ещё один отзыв"}
    )
    assert duplicate.status_code == 409

    updated = client.put(f"/api/account/reviews/{review['id']}", json={"rating": 5, "text": "Отличный телефон!"})
    assert updated.status_code == 200
    assert updated.get_json()["rating"] == 5
    assert updated.get_json()["updated_at"]

    assert client.get("/api/account/profile").get_json()["stats"]["reviews"] == 1
    assert client.delete(f"/api/account/reviews/{review['id']}").status_code == 200
    assert client.get("/api/account/reviews").get_json() == []


@pytest.mark.parametrize(
    "body",
    [
        {"product_id": 0, "rating": 5, "text": "Хороший товар"},
        {"product_id": 1, "rating": 9, "text": "Хороший товар"},
        {"product_id": 1, "rating": 5, "text": "ок"},
    ],
)
def test_review_validation(user, body):
    assert user["client"].post("/api/account/reviews", json=body).status_code == 400


def test_review_of_another_user_is_hidden(flask_app, user, product):
    app, engine = flask_app
    with Session(engine) as session:
        stranger = Users(
            name="Чужой", email=f"{uuid4()}@mail.ru", password=hash_password("qwerty12"), status=False
        )
        session.add(stranger)
        session.flush()
        review = Review(
            user_id=stranger.id,
            product_id=product,
            rating=5,
            text="Чужой отзыв",
            created_at="2026-10-04T12:00:00+00:00",
        )
        session.add(review)
        session.commit()
        review_id = review.id

    client = user["client"]
    assert client.get("/api/account/reviews").get_json() == []
    assert client.put(f"/api/account/reviews/{review_id}", json={"rating": 1, "text": "Подмена"}).status_code == 404


# --------------------------------------------------------------------------- #
# Настройки, товары, чат
# --------------------------------------------------------------------------- #
def test_settings_are_saved(user):
    client = user["client"]
    assert client.get("/api/account/settings").get_json() == {"notify_orders": True, "notify_promo": True}

    response = client.put("/api/account/settings", json={"notify_promo": False})
    assert response.status_code == 200
    assert response.get_json() == {"notify_orders": True, "notify_promo": False}
    assert client.get("/api/account/settings").get_json()["notify_promo"] is False


def test_products_endpoint_is_available(user, product):
    products = user["client"].get("/api/account/products").get_json()
    assert any(item["id"] == product for item in products)
    assert {"id", "title", "price", "url"} <= set(products[0])


def test_chat_unread_is_marked_read(flask_app, user):
    app, engine = flask_app
    with Session(engine) as session:
        admin_user = Users(
            name="Поддержка", email=f"{uuid4()}@mail.ru", password=hash_password("qwerty12"), status=False
        )
        session.add(admin_user)
        session.flush()
        session.add(Admin(name="Поддержка", IP="127.0.0.1", user_id=admin_user.id))
        session.add(
            Messages(
                text="Здравствуйте!",
                time_send="2026-10-04T12:00:00+00:00",
                from_user=admin_user.id,
                to_user=user["id"],
                is_read=False,
            )
        )
        session.commit()

    client = user["client"]
    assert client.get("/api/account/profile").get_json()["stats"]["unread_messages"] == 1
    assert client.get("/api/account/chat/unread").get_json()["unread"] == 1

    assert client.post("/api/account/chat/read").status_code == 200
    assert client.get("/api/account/chat/unread").get_json()["unread"] == 0

    with Session(engine) as session:
        message = session.scalar(select(Messages).where(Messages.to_user == user["id"]))
        assert message.is_read is True


def test_chat_endpoints_are_available(user):
    client = user["client"]
    assert client.get("/api/admin/chat").status_code == 200
    assert client.post("/api/admin/messages", json={"text": "Здравствуйте"}).status_code == 200


def test_favorite_and_review_tables_are_used(user, product):
    """Избранное и отзывы действительно пишутся в БД, а не только в ответ API."""
    client = user["client"]
    client.post("/api/account/favorites", json={"product_id": product})
    client.post("/api/account/reviews", json={"product_id": product, "rating": 5, "text": "Всё отлично!"})

    with Session(user["engine"]) as session:
        favorite = session.scalar(select(Favorite).where(Favorite.user_id == user["id"]))
        review = session.scalar(select(Review).where(Review.user_id == user["id"]))
        assert favorite.product_id == product
        assert review.rating == 5
