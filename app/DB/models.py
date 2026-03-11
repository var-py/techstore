from typing import List
from typing import Optional
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship


class Base(DeclarativeBase):
    pass

class Users(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    email: Mapped[str] = mapped_column(nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)
    orders: Mapped[List["Order"]] = relationship(back_populates="users")
    status: Mapped[bool] = mapped_column(nullable=False, default=False)
    # users_music: Mapped[List["Users_music"]] = relationship(
    #     back_populates="users", cascade="all, delete-orphan"
    # )
    def __repr__(self) -> str:
        return f"users(id={self.id}, name={self.name}, email={self.email}, password={self.password})"

class Admin(Base):
    __tablename__ = "admin"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    IP: Mapped[str] = mapped_column(nullable=False)
    user_id: Mapped[int] = mapped_column(nullable=False)
    def __repr__(self) -> str:
        return f"admin(id={self.id}, name={self.name}, IP={self.IP}, user_id={self.user_id})"

class Order(Base):
    __tablename__ = "order"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int]= mapped_column(ForeignKey("users.id"))
    status: Mapped[str]= mapped_column(nullable=False)
    created_at: Mapped[str] = mapped_column(nullable=False)
    users: Mapped["Users"] = relationship(back_populates="orders")
    def __repr__(self) -> str:
        return f"order(created_at={self.created_at}, count={self.count},user_id={self.user_id})"

class Product(Base):
    __tablename__ = "product"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]= mapped_column(nullable=False)
    price: Mapped[str] = mapped_column(nullable=False)
    photo: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)
    category: Mapped[str] = mapped_column(nullable=False)
    brand: Mapped[str] = mapped_column(nullable=False)
    # favorite: Mapped[List["Favorite"]] = relationship(back_populates="music")
    def __repr__(self) -> str:
        return f"product(id={self.id}, title={self.title},price={self.price},photo={self.photo},description={self.description}, category={self.category}, brand={self.brand})"
class Order_item(Base):
    __tablename__ = "order_item"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int]= mapped_column(ForeignKey("order.id"),nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id"),nullable=False)
    qty: Mapped[int] = mapped_column(nullable=False)
    price_at_purchase: Mapped[float] = mapped_column(nullable=False)
    # users: Mapped["Users"] = relationship(back_populates="favorite")
    # music: Mapped["Music"] = relationship(back_populates="favorite")
    def __repr__(self) -> str:
        return f"order_item(id={self.id},product_id={self.product_id}, qty={self.qty}, price_at_purchase={self.price_at_purchase})"
class Code(Base):
    __tablename__ = "code"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(nullable=False)
    email: Mapped[str] = mapped_column(nullable=False)
    def __repr__(self) -> str:
        return f"code(id={self.id}, code={self.code}, email={self.email})"
class CountProduct(Base):
    __tablename__ = "count_product"
    id: Mapped[int] = mapped_column(primary_key=True)
    count: Mapped[str] = mapped_column(nullable=False)
    sale: Mapped[str] = mapped_column(nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id"))
    def __repr__(self) -> str:
        return f"code(id={self.id}, code={self.count}, email={self.sale}, product_id={self.product_id})"
class Massages(Base):
    __tablename__ = "massages"
    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(nullable=False)
    time_send: Mapped[str] = mapped_column(nullable=False)
    from_user: Mapped[int] = mapped_column(ForeignKey("users.id"))
    to_user: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_read: Mapped[bool] = mapped_column(nullable=False, default=False)
    def __repr__(self) -> str:
        return f"code(id={self.id},text={self.text})"
