"""API личного кабинета.

Все разделы кабинета (`/account`) работают через эти эндпоинты:
личные данные, заказы, адреса доставки, избранное, отзывы и настройки.
Каждый запрос требует активной сессии, иначе возвращается 401.
"""
from __future__ import annotations

import re
from decimal import Decimal
from functools import wraps

from flask import Blueprint, jsonify, request, session as session_login
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.DB.models import (
    Address,
    Admin,
    Favorite,
    Messages,
    Order,
    Order_item,
    Product,
    Review,
    Users,
    now_iso,
)
from app.DB.session import engine
from app.utils.security import hash_password, verify_password

account_api = Blueprint("account_api", __name__, url_prefix="/api/account")

MIN_PASSWORD_LENGTH = 6
MAX_PASSWORD_LENGTH = 128
MAX_TEXT_LENGTH = 5000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Zа-яА-Я]{2,}$")

# Статусы заказов: как их хранят в БД -> (подпись для интерфейса, вид бейджа).
STATUS_MAP = {
    "processing": ("В обработке", "processing"),
    "в обработке": ("В обработке", "processing"),
    "new": ("Новый", "processing"),
    "новый": ("Новый", "processing"),
    "paid": ("Оплачен", "delivered"),
    "shipped": ("Отправлен", "shipped"),
    "отправлен": ("Отправлен", "shipped"),
    "delivered": ("Доставлен", "delivered"),
    "доставлен": ("Доставлен", "delivered"),
    "cancelled": ("Отменён", "cancelled"),
    "canceled": ("Отменён", "cancelled"),
    "отменен": ("Отменён", "cancelled"),
    "отменён": ("Отменён", "cancelled"),
}


# --------------------------------------------------------------------------- #
# Вспомогательные функции
# --------------------------------------------------------------------------- #
def login_required(view):
    """Пускает дальше только авторизованного пользователя."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        if session_login.get("user_id") is None:
            return jsonify({"error": "Требуется авторизация"}), 401
        return view(*args, **kwargs)

    return wrapper


def payload() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def error(message: str, code: int = 400):
    return jsonify({"error": message}), code


def to_int(value, default=None):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def positive_int(value, default=None):
    """Идентификатор из запроса: 0, пустая строка и мусор не считаются id."""
    number = to_int(value)
    if number is None or number <= 0:
        return default
    return number


def to_float(value, default: float = 0.0) -> float:
    """Цены в БД лежат строками («89 999 ₽»), поэтому разбираем аккуратно."""
    if value is None:
        return default
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    cleaned = re.sub(r"[^0-9,.\-]", "", str(value)).replace(",", ".")
    if cleaned.count(".") > 1:  # убираем разделители тысяч
        head, _, tail = cleaned.rpartition(".")
        cleaned = head.replace(".", "") + "." + tail
    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return default


def clean_text(value, limit: int = 255) -> str:
    return str(value or "").strip()[:limit]


def check_password(candidate: str, stored: str) -> bool:
    """verify_password падает на битом хеше, поэтому проверяем безопасно."""
    if not candidate or not stored:
        return False
    try:
        return bool(verify_password(candidate, stored))
    except Exception:
        return False


def status_info(raw) -> tuple[str, str]:
    key = str(raw or "").strip().lower()
    return STATUS_MAP.get(key, (str(raw or "Новый"), "processing"))


def serialize_product(product: Product) -> dict:
    return {
        "id": product.id,
        "title": product.title,
        "price": to_float(product.price),
        "price_raw": product.price,
        "category": product.category,
        "brand": product.brand,
        "photo": product.photo or "",
        "url": f"/product/{product.id}",
    }


def admin_ids(session: Session) -> list[int]:
    return list(session.scalars(select(Admin.user_id)).all())


def stats_for(session: Session, user_id: int) -> dict:
    orders = session.scalar(select(func.count(Order.id)).where(Order.user_id == user_id)) or 0
    favorites = session.scalar(select(func.count(Favorite.id)).where(Favorite.user_id == user_id)) or 0
    reviews = session.scalar(select(func.count(Review.id)).where(Review.user_id == user_id)) or 0
    addresses = session.scalar(select(func.count(Address.id)).where(Address.user_id == user_id)) or 0
    admins = admin_ids(session)
    unread = 0
    if admins:
        unread = session.scalar(
            select(func.count(Messages.id)).where(
                Messages.to_user == user_id,
                Messages.from_user.in_(admins),
                Messages.is_read.is_not(True),
            )
        ) or 0
    return {
        "orders": orders,
        "favorites": favorites,
        "reviews": reviews,
        "addresses": addresses,
        "unread_messages": unread,
    }


def serialize_user(user: Users) -> dict:
    created_at = user.created_at
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
        "notify_orders": bool(user.notify_orders),
        "notify_promo": bool(user.notify_promo),
    }


def serialize_address(address: Address) -> dict:
    parts = [address.city, address.street, f"д. {address.house}"]
    if address.apartment:
        parts.append(f"кв. {address.apartment}")
    return {
        "id": address.id,
        "recipient": address.recipient,
        "phone": address.phone,
        "city": address.city,
        "street": address.street,
        "house": address.house,
        "apartment": address.apartment or "",
        "postcode": address.postcode or "",
        "comment": address.comment or "",
        "is_default": bool(address.is_default),
        "created_at": address.created_at,
        "full": ", ".join(parts),
    }


def serialize_order(session: Session, order: Order) -> dict:
    rows = session.execute(
        select(Order_item, Product)
        .join(Product, Product.id == Order_item.product_id, isouter=True)
        .where(Order_item.order_id == order.id)
        .order_by(Order_item.id)
    ).all()

    items = []
    total = 0.0
    qty_total = 0
    for item, product in rows:
        price = item.price_at_purchase
        if price is None:
            price = product.price if product is not None else 0
        price = to_float(price)
        qty = max(1, to_int(item.qty, 1))
        total += price * qty
        qty_total += qty
        items.append(
            {
                "product_id": item.product_id,
                "title": product.title if product is not None else f"Товар №{item.product_id}",
                "photo": (product.photo if product is not None else "") or "",
                "url": f"/product/{item.product_id}",
                "qty": qty,
                "price": round(price, 2),
                "sum": round(price * qty, 2),
                "available": product is not None,
            }
        )

    label, kind = status_info(order.status)
    address = session.get(Address, order.address_id) if order.address_id else None
    return {
        "id": order.id,
        "number": f"{order.id:06d}",
        "created_at": order.created_at,
        "status": order.status,
        "status_label": label,
        "status_kind": kind,
        "items": items,
        "items_count": qty_total,
        "total": round(total, 2),
        "address": serialize_address(address) if address is not None else None,
    }


def make_order(session: Session, user_id: int, product_id: int, qty: int, address_id=None) -> Order:
    """Создаёт заказ с одной позицией. Используется кабинетом и /order/done."""
    product = session.get(Product, product_id)
    if product is None:
        raise LookupError("Товар не найден")

    if address_id is not None:
        address = session.get(Address, address_id)
        if address is None or address.user_id != user_id:
            raise LookupError("Адрес доставки не найден")

    order = Order(
        user_id=user_id,
        status="processing",
        created_at=now_iso(),
        address_id=address_id,
    )
    session.add(order)
    session.flush()

    session.add(
        Order_item(
            order_id=order.id,
            product_id=product.id,
            qty=qty,
            price_at_purchase=to_float(product.price),
        )
    )
    session.commit()
    return order


# --------------------------------------------------------------------------- #
# Личные данные
# --------------------------------------------------------------------------- #
@account_api.route("/profile", methods=["GET"])
@login_required
def get_profile():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        user = session.get(Users, user_id)
        if user is None:
            session_login.clear()
            return error("Пользователь не найден", 401)
        return jsonify({"user": serialize_user(user), "stats": stats_for(session, user_id)})


@account_api.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    user_id = session_login["user_id"]
    data = payload()
    name = clean_text(data.get("name"), 120)
    email = clean_text(data.get("email"), 190).lower()

    if not name:
        return error("Укажите имя")
    if not EMAIL_RE.match(email):
        return error("Укажите корректный email")

    with Session(engine) as session:
        user = session.get(Users, user_id)
        if user is None:
            session_login.clear()
            return error("Пользователь не найден", 401)

        taken = session.scalar(
            select(Users).where(func.lower(Users.email) == email, Users.id != user_id)
        )
        if taken is not None:
            return error("Этот email уже используется", 409)

        user.name = name
        user.email = email
        session.commit()
        return jsonify({"user": serialize_user(user), "stats": stats_for(session, user_id)})


@account_api.route("/password", methods=["POST"])
@login_required
def change_password():
    user_id = session_login["user_id"]
    data = payload()
    current = str(data.get("current_password") or "")
    new = str(data.get("new_password") or "")
    confirm = str(data.get("confirm_password") or new)

    if not current:
        return error("Введите текущий пароль")
    if len(new) < MIN_PASSWORD_LENGTH:
        return error(f"Новый пароль должен быть не короче {MIN_PASSWORD_LENGTH} символов")
    if len(new) > MAX_PASSWORD_LENGTH:
        return error("Новый пароль слишком длинный")
    if new != confirm:
        return error("Пароли не совпадают")

    with Session(engine) as session:
        user = session.get(Users, user_id)
        if user is None:
            session_login.clear()
            return error("Пользователь не найден", 401)
        if not check_password(current, user.password):
            return error("Неверный текущий пароль", 400)
        if check_password(new, user.password):
            return error("Новый пароль совпадает с текущим")
        user.password = hash_password(new)
        session.commit()
    return jsonify({"message": "Пароль изменён"})


# --------------------------------------------------------------------------- #
# Заказы
# --------------------------------------------------------------------------- #
@account_api.route("/orders", methods=["GET"])
@login_required
def list_orders():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        orders = session.scalars(
            select(Order).where(Order.user_id == user_id).order_by(Order.id.desc())
        ).all()
        return jsonify([serialize_order(session, order) for order in orders])


@account_api.route("/orders", methods=["POST"])
@login_required
def create_order():
    user_id = session_login["user_id"]
    data = payload()
    product_id = positive_int(data.get("product_id"))
    qty = max(1, to_int(data.get("qty"), 1))
    address_id = positive_int(data.get("address_id"))

    if product_id is None:
        return error("Не указан товар")

    with Session(engine) as session:
        try:
            order = make_order(session, user_id, product_id, qty, address_id)
        except LookupError as exc:
            return error(str(exc), 404)
        return jsonify(serialize_order(session, order)), 201


@account_api.route("/orders/<int:order_id>/repeat", methods=["POST"])
@login_required
def repeat_order(order_id: int):
    user_id = session_login["user_id"]
    with Session(engine) as session:
        order = session.get(Order, order_id)
        if order is None or order.user_id != user_id:
            return error("Заказ не найден", 404)
        items = session.scalars(
            select(Order_item).where(Order_item.order_id == order.id)
        ).all()
        if not items:
            return error("В заказе нет товаров")

        new_order = Order(user_id=user_id, status="processing", created_at=now_iso())
        session.add(new_order)
        session.flush()
        for item in items:
            session.add(
                Order_item(
                    order_id=new_order.id,
                    product_id=item.product_id,
                    qty=item.qty,
                    price_at_purchase=item.price_at_purchase,
                )
            )
        session.commit()
        return jsonify(serialize_order(session, new_order)), 201


# --------------------------------------------------------------------------- #
# Адреса доставки
# --------------------------------------------------------------------------- #
ADDRESS_FIELDS = ("recipient", "phone", "city", "street", "house")


def _read_address(data: dict) -> dict:
    values = {
        "recipient": clean_text(data.get("recipient"), 120),
        "phone": clean_text(data.get("phone"), 40),
        "city": clean_text(data.get("city"), 120),
        "street": clean_text(data.get("street"), 180),
        "house": clean_text(data.get("house"), 40),
        "apartment": clean_text(data.get("apartment"), 40) or None,
        "postcode": clean_text(data.get("postcode"), 20) or None,
        "comment": clean_text(data.get("comment"), 255) or None,
    }
    missing = [field for field in ADDRESS_FIELDS if not values[field]]
    return {"values": values, "missing": missing}


def _clear_default(session: Session, user_id: int, keep_id=None) -> None:
    query = select(Address).where(Address.user_id == user_id, Address.is_default.is_(True))
    if keep_id is not None:
        query = query.where(Address.id != keep_id)
    for address in session.scalars(query).all():
        address.is_default = False


@account_api.route("/addresses", methods=["GET"])
@login_required
def list_addresses():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        addresses = session.scalars(
            select(Address)
            .where(Address.user_id == user_id)
            .order_by(Address.is_default.desc(), Address.id.desc())
        ).all()
        return jsonify([serialize_address(address) for address in addresses])


@account_api.route("/addresses", methods=["POST"])
@login_required
def create_address():
    user_id = session_login["user_id"]
    parsed = _read_address(payload())
    if parsed["missing"]:
        return error("Заполните обязательные поля адреса")

    with Session(engine) as session:
        has_any = session.scalar(select(func.count(Address.id)).where(Address.user_id == user_id)) or 0
        make_default = bool(payload().get("is_default")) or has_any == 0
        if make_default:
            _clear_default(session, user_id)
        address = Address(user_id=user_id, is_default=make_default, created_at=now_iso(), **parsed["values"])
        session.add(address)
        session.commit()
        return jsonify(serialize_address(address)), 201


@account_api.route("/addresses/<int:address_id>", methods=["PUT"])
@login_required
def update_address(address_id: int):
    user_id = session_login["user_id"]
    data = payload()
    parsed = _read_address(data)
    if parsed["missing"]:
        return error("Заполните обязательные поля адреса")

    with Session(engine) as session:
        address = session.get(Address, address_id)
        if address is None or address.user_id != user_id:
            return error("Адрес не найден", 404)
        for field, value in parsed["values"].items():
            setattr(address, field, value)
        if data.get("is_default"):
            _clear_default(session, user_id, keep_id=address.id)
            address.is_default = True
        session.commit()
        return jsonify(serialize_address(address))


@account_api.route("/addresses/<int:address_id>", methods=["DELETE"])
@login_required
def delete_address(address_id: int):
    user_id = session_login["user_id"]
    with Session(engine) as session:
        address = session.get(Address, address_id)
        if address is None or address.user_id != user_id:
            return error("Адрес не найден", 404)
        was_default = bool(address.is_default)
        session.delete(address)
        session.flush()
        if was_default:
            replacement = session.scalar(
                select(Address)
                .where(Address.user_id == user_id)
                .order_by(Address.id.desc())
                .limit(1)
            )
            if replacement is not None:
                replacement.is_default = True
        session.commit()
    return jsonify({"message": "Адрес удалён"})


@account_api.route("/addresses/<int:address_id>/default", methods=["POST"])
@login_required
def set_default_address(address_id: int):
    user_id = session_login["user_id"]
    with Session(engine) as session:
        address = session.get(Address, address_id)
        if address is None or address.user_id != user_id:
            return error("Адрес не найден", 404)
        _clear_default(session, user_id, keep_id=address.id)
        address.is_default = True
        session.commit()
        return jsonify(serialize_address(address))


# --------------------------------------------------------------------------- #
# Избранное
# --------------------------------------------------------------------------- #
@account_api.route("/favorites", methods=["GET"])
@login_required
def list_favorites():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        rows = session.execute(
            select(Favorite, Product)
            .join(Product, Product.id == Favorite.product_id, isouter=True)
            .where(Favorite.user_id == user_id)
            .order_by(Favorite.id.desc())
        ).all()
        favorites = []
        for favorite, product in rows:
            item = serialize_product(product) if product is not None else {
                "id": favorite.product_id,
                "title": f"Товар №{favorite.product_id}",
                "price": 0,
                "price_raw": "0",
                "category": "",
                "brand": "",
                "photo": "",
                "url": f"/product/{favorite.product_id}",
            }
            item["added_at"] = favorite.created_at
            item["available"] = product is not None
            favorites.append(item)
        return jsonify(favorites)


@account_api.route("/favorites", methods=["POST"])
@login_required
def add_favorite():
    user_id = session_login["user_id"]
    product_id = positive_int(payload().get("product_id"))
    if product_id is None:
        return error("Не указан товар")

    with Session(engine) as session:
        product = session.get(Product, product_id)
        if product is None:
            return error("Товар не найден", 404)
        exists = session.scalar(
            select(Favorite).where(Favorite.user_id == user_id, Favorite.product_id == product_id)
        )
        if exists is not None:
            return jsonify({"message": "Товар уже в избранном", "added": False})
        session.add(Favorite(user_id=user_id, product_id=product_id, created_at=now_iso()))
        session.commit()
        return jsonify({"message": "Товар добавлен в избранное", "added": True}), 201


@account_api.route("/favorites/<int:product_id>", methods=["DELETE"])
@login_required
def remove_favorite(product_id: int):
    user_id = session_login["user_id"]
    with Session(engine) as session:
        favorite = session.scalar(
            select(Favorite).where(Favorite.user_id == user_id, Favorite.product_id == product_id)
        )
        if favorite is None:
            return error("Товар не в избранном", 404)
        session.delete(favorite)
        session.commit()
    return jsonify({"message": "Товар удалён из избранного", "removed": True})


# --------------------------------------------------------------------------- #
# Отзывы
# --------------------------------------------------------------------------- #
def serialize_review(session: Session, review: Review) -> dict:
    product = session.get(Product, review.product_id)
    return {
        "id": review.id,
        "product_id": review.product_id,
        "product_title": product.title if product is not None else f"Товар №{review.product_id}",
        "product_photo": (product.photo if product is not None else "") or "",
        "url": f"/product/{review.product_id}",
        "rating": int(review.rating or 0),
        "text": review.text,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


@account_api.route("/reviews", methods=["GET"])
@login_required
def list_reviews():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        reviews = session.scalars(
            select(Review).where(Review.user_id == user_id).order_by(Review.id.desc())
        ).all()
        return jsonify([serialize_review(session, review) for review in reviews])


@account_api.route("/reviews", methods=["POST"])
@login_required
def create_review():
    user_id = session_login["user_id"]
    data = payload()
    product_id = positive_int(data.get("product_id"))
    rating = to_int(data.get("rating"))
    text = clean_text(data.get("text"), MAX_TEXT_LENGTH)

    if product_id is None:
        return error("Выберите товар")
    if rating is None or not 1 <= rating <= 5:
        return error("Оценка должна быть от 1 до 5")
    if len(text) < 5:
        return error("Напишите отзыв (минимум 5 символов)")

    with Session(engine) as session:
        if session.get(Product, product_id) is None:
            return error("Товар не найден", 404)
        exists = session.scalar(
            select(Review).where(Review.user_id == user_id, Review.product_id == product_id)
        )
        if exists is not None:
            return error("Вы уже оставили отзыв об этом товаре", 409)
        review = Review(
            user_id=user_id,
            product_id=product_id,
            rating=rating,
            text=text,
            created_at=now_iso(),
        )
        session.add(review)
        session.commit()
        return jsonify(serialize_review(session, review)), 201


@account_api.route("/reviews/<int:review_id>", methods=["PUT"])
@login_required
def update_review(review_id: int):
    user_id = session_login["user_id"]
    data = payload()
    text = clean_text(data.get("text"), MAX_TEXT_LENGTH)
    rating = to_int(data.get("rating"))

    if rating is None or not 1 <= rating <= 5:
        return error("Оценка должна быть от 1 до 5")
    if len(text) < 5:
        return error("Напишите отзыв (минимум 5 символов)")

    with Session(engine) as session:
        review = session.get(Review, review_id)
        if review is None or review.user_id != user_id:
            return error("Отзыв не найден", 404)
        review.rating = rating
        review.text = text
        review.updated_at = now_iso()
        session.commit()
        return jsonify(serialize_review(session, review))


@account_api.route("/reviews/<int:review_id>", methods=["DELETE"])
@login_required
def delete_review(review_id: int):
    user_id = session_login["user_id"]
    with Session(engine) as session:
        review = session.get(Review, review_id)
        if review is None or review.user_id != user_id:
            return error("Отзыв не найден", 404)
        session.delete(review)
        session.commit()
    return jsonify({"message": "Отзыв удалён"})


# --------------------------------------------------------------------------- #
# Настройки и вспомогательные данные
# --------------------------------------------------------------------------- #
@account_api.route("/settings", methods=["GET"])
@login_required
def get_settings():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        user = session.get(Users, user_id)
        if user is None:
            session_login.clear()
            return error("Пользователь не найден", 401)
        return jsonify(
            {
                "notify_orders": bool(user.notify_orders),
                "notify_promo": bool(user.notify_promo),
            }
        )


@account_api.route("/settings", methods=["PUT"])
@login_required
def update_settings():
    user_id = session_login["user_id"]
    data = payload()
    with Session(engine) as session:
        user = session.get(Users, user_id)
        if user is None:
            session_login.clear()
            return error("Пользователь не найден", 401)
        if "notify_orders" in data:
            user.notify_orders = bool(data.get("notify_orders"))
        if "notify_promo" in data:
            user.notify_promo = bool(data.get("notify_promo"))
        session.commit()
        return jsonify(
            {
                "notify_orders": bool(user.notify_orders),
                "notify_promo": bool(user.notify_promo),
            }
        )


@account_api.route("/products", methods=["GET"])
@login_required
def list_products():
    """Список товаров для выбора в форме отзыва и в избранном."""
    limit = min(max(to_int(request.args.get("limit"), 200) or 200, 1), 500)
    with Session(engine) as session:
        products = session.scalars(select(Product).order_by(Product.title).limit(limit)).all()
        return jsonify([serialize_product(product) for product in products])


@account_api.route("/chat/unread", methods=["GET"])
@login_required
def chat_unread():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        admins = admin_ids(session)
        if not admins:
            return jsonify({"unread": 0})
        unread = session.scalar(
            select(func.count(Messages.id)).where(
                Messages.to_user == user_id,
                Messages.from_user.in_(admins),
                Messages.is_read.is_not(True),
            )
        ) or 0
        return jsonify({"unread": unread})


@account_api.route("/chat/read", methods=["POST"])
@login_required
def chat_mark_read():
    user_id = session_login["user_id"]
    with Session(engine) as session:
        admins = admin_ids(session)
        if admins:
            messages = session.scalars(
                select(Messages).where(
                    Messages.to_user == user_id,
                    Messages.from_user.in_(admins),
                    Messages.is_read.is_not(True),
                )
            ).all()
            for message in messages:
                message.is_read = True
            session.commit()
    return jsonify({"message": "Сообщения прочитаны"})
