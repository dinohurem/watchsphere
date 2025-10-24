from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.db.base import Base


class WatchCondition(str, enum.Enum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"


class Watch(Base):
    __tablename__ = "watches"

    id = Column(String, primary_key=True, index=True)
    brand = Column(String, nullable=False, index=True)
    model = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    condition = Column(Enum(WatchCondition), nullable=False)
    year = Column(Integer)
    serial_number = Column(String, unique=True)
    description = Column(String)

    # Foreign key to user
    dealer_id = Column(String, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    dealer = relationship("User", backref="watches")
