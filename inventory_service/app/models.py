from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column


class Base(DeclarativeBase):
    pass

class Product(Base):
    __tablename__ = "product_available"
    id: Mapped[int] = mapped_column(primary_key=True)
    available: Mapped[bool] = mapped_column(nullable=False)
    def __repr__(self) -> str:
        return f"product(id={self.id},available={self.available})"
