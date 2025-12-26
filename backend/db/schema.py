"""
Procurement Operation Management System - Database Schema
Using SQLAlchemy ORM with Pydantic for validation
"""

from datetime import datetime, date, time
from decimal import Decimal
from enum import Enum as PyEnum
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, Time,
    ForeignKey, Numeric, JSON, Enum, UniqueConstraint, Index, create_engine
)
from sqlalchemy.orm import relationship, declarative_base
from pydantic import BaseModel, Field, ConfigDict

Base = declarative_base()


# ============================================================================
# ENUMS
# ============================================================================

class OrderStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PARTIALLY_COMPLETED = "partially_completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ItemStatus(str, PyEnum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PURCHASED = "purchased"
    FAILED = "failed"
    DISCONTINUED = "discontinued"
    OUT_OF_STOCK = "out_of_stock"
    RESTOCKING = "restocking"


class StockStatus(str, PyEnum):
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    DISCONTINUED = "discontinued"
    UNKNOWN = "unknown"


class PurchaseStatus(str, PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PURCHASED = "purchased"
    FAILED = "failed"
    SKIPPED = "skipped"


class RouteStatus(str, PyEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StopStatus(str, PyEnum):
    PENDING = "pending"
    CURRENT = "current"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class ListStatus(str, PyEnum):
    DRAFT = "draft"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class FailureType(str, PyEnum):
    DISCONTINUED = "discontinued"
    OUT_OF_STOCK = "out_of_stock"
    STORE_CLOSED = "store_closed"
    PRICE_MISMATCH = "price_mismatch"
    PRODUCT_NOT_FOUND = "product_not_found"
    OTHER = "other"


class RuleType(str, PyEnum):
    CUTOFF = "cutoff"
    ASSIGNMENT = "assignment"
    ROUTING = "routing"
    PRIORITY = "priority"
    CAPACITY = "capacity"


class StaffStatus(str, PyEnum):
    ACTIVE = "active"
    EN_ROUTE = "en_route"
    IDLE = "idle"
    OFF_DUTY = "off_duty"


class StaffRole(str, PyEnum):
    BUYER = "buyer"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class LogType(str, PyEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    AUDIT = "audit"


# ============================================================================
# SQLALCHEMY MODELS
# ============================================================================

class Order(Base):
    """Core order from Robot-in or mall APIs"""
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    robot_in_order_id = Column(String(100), unique=True, nullable=True)
    mall_name = Column(String(100), nullable=True)
    customer_name = Column(String(200), nullable=True)
    order_date = Column(DateTime, nullable=False)
    order_status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    cutoff_time = Column(DateTime, nullable=True)
    target_purchase_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_order_date", "order_date"),
        Index("idx_order_status", "order_status"),
        Index("idx_target_purchase_date", "target_purchase_date"),
    )


class OrderItem(Base):
    """Individual items within an order"""
    __tablename__ = "order_items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    sku = Column(String(100), nullable=False)
    product_name = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=True)
    is_bundle = Column(Boolean, default=False)
    parent_item_id = Column(Integer, ForeignKey("order_items.item_id"), nullable=True)
    item_status = Column(Enum(ItemStatus), default=ItemStatus.PENDING)
    priority = Column(String(20), default="normal")  # high, normal, low
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    order = relationship("Order", back_populates="items")
    parent_item = relationship("OrderItem", remote_side=[item_id], backref="child_items")
    purchase_list_items = relationship("PurchaseListItem", back_populates="order_item")

    __table_args__ = (
        Index("idx_item_sku", "sku"),
        Index("idx_item_status", "item_status"),
    )


class Product(Base):
    """Product master data"""
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String(100), unique=True, nullable=False)
    product_name = Column(String(500), nullable=False)
    category = Column(String(100), nullable=True)
    is_set_product = Column(Boolean, default=False)
    set_split_rule = Column(JSON, nullable=True)  # Rules for splitting set products
    is_store_fixed = Column(Boolean, default=False)
    fixed_store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=True)
    exclude_from_routing = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    fixed_store = relationship("Store", foreign_keys=[fixed_store_id])
    store_mappings = relationship("ProductStoreMapping", back_populates="product")
    store_inventory = relationship("StoreInventory", back_populates="product")

    __table_args__ = (
        Index("idx_product_category", "category"),
    )


class Store(Base):
    """Store master data (200-300 stores)"""
    __tablename__ = "stores"

    store_id = Column(Integer, primary_key=True, autoincrement=True)
    store_name = Column(String(200), nullable=False)
    store_code = Column(String(50), unique=True, nullable=True)
    address = Column(String(500), nullable=True)
    district = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    opening_hours = Column(JSON, nullable=True)  # {"mon": "10:00-21:00", ...}
    category = Column(String(100), nullable=True)  # 家電, 食品・飲料, etc.
    priority_level = Column(Integer, default=2)  # 1=highest priority
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product_mappings = relationship("ProductStoreMapping", back_populates="store")
    inventory = relationship("StoreInventory", back_populates="store")
    route_stops = relationship("RouteStop", back_populates="store")
    purchase_list_items = relationship("PurchaseListItem", back_populates="store")

    __table_args__ = (
        Index("idx_store_district", "district"),
        Index("idx_store_category", "category"),
        Index("idx_store_active", "is_active"),
    )


class ProductStoreMapping(Base):
    """Which products are available at which stores"""
    __tablename__ = "product_store_mapping"

    mapping_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False)
    is_primary_store = Column(Boolean, default=False)
    priority = Column(Integer, default=1)
    last_available_date = Column(Date, nullable=True)
    stock_status = Column(Enum(StockStatus), default=StockStatus.UNKNOWN)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="store_mappings")
    store = relationship("Store", back_populates="product_mappings")

    __table_args__ = (
        UniqueConstraint("product_id", "store_id", name="uq_product_store"),
        Index("idx_mapping_stock_status", "stock_status"),
    )


class StoreInventory(Base):
    """Current inventory status per store"""
    __tablename__ = "store_inventory"

    inventory_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False)
    stock_status = Column(Enum(StockStatus), default=StockStatus.UNKNOWN)
    discontinuation_date = Column(Date, nullable=True)
    expected_restock_date = Column(Date, nullable=True)
    last_checked_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", back_populates="inventory")
    product = relationship("Product", back_populates="store_inventory")

    __table_args__ = (
        UniqueConstraint("store_id", "product_id", name="uq_store_product_inventory"),
    )


class Staff(Base):
    """Staff members (5-10 buyers)"""
    __tablename__ = "staff"

    staff_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_name = Column(String(100), nullable=False)
    staff_code = Column(String(50), unique=True, nullable=True)
    email = Column(String(200), unique=True, nullable=True)
    phone = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(Enum(StaffRole), default=StaffRole.BUYER)
    status = Column(Enum(StaffStatus), default=StaffStatus.OFF_DUTY)
    start_location_lat = Column(Numeric(10, 7), nullable=True)
    start_location_lng = Column(Numeric(10, 7), nullable=True)
    start_location_name = Column(String(200), default="オフィス（六本木）")
    current_location_lat = Column(Numeric(10, 7), nullable=True)
    current_location_lng = Column(Numeric(10, 7), nullable=True)
    current_location_name = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    max_daily_capacity = Column(Integer, default=20)  # Max orders per day
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    purchase_lists = relationship("PurchaseList", back_populates="staff")
    routes = relationship("Route", back_populates="staff")

    __table_args__ = (
        Index("idx_staff_active", "is_active"),
        Index("idx_staff_status", "status"),
    )


class PurchaseList(Base):
    """Daily purchase list per staff member"""
    __tablename__ = "purchase_lists"

    list_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=False)
    purchase_date = Column(Date, nullable=False)
    list_status = Column(Enum(ListStatus), default=ListStatus.DRAFT)
    total_items = Column(Integer, default=0)
    total_stores = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    staff = relationship("Staff", back_populates="purchase_lists")
    items = relationship("PurchaseListItem", back_populates="purchase_list", cascade="all, delete-orphan")
    route = relationship("Route", back_populates="purchase_list", uselist=False)

    __table_args__ = (
        Index("idx_purchase_date", "purchase_date"),
        Index("idx_list_status", "list_status"),
    )


class PurchaseListItem(Base):
    """Items in a purchase list with store assignment"""
    __tablename__ = "purchase_list_items"

    list_item_id = Column(Integer, primary_key=True, autoincrement=True)
    list_id = Column(Integer, ForeignKey("purchase_lists.list_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("order_items.item_id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    sequence_order = Column(Integer, default=0)
    purchase_status = Column(Enum(PurchaseStatus), default=PurchaseStatus.PENDING)
    actual_price = Column(Numeric(12, 2), nullable=True)
    purchase_time = Column(DateTime, nullable=True)
    failure_reason = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    purchase_list = relationship("PurchaseList", back_populates="items")
    order_item = relationship("OrderItem", back_populates="purchase_list_items")
    store = relationship("Store", back_populates="purchase_list_items")
    failures = relationship("PurchaseFailure", back_populates="list_item")

    __table_args__ = (
        Index("idx_purchase_status", "purchase_status"),
    )


class Route(Base):
    """Optimized route for a purchase list"""
    __tablename__ = "routes"

    route_id = Column(Integer, primary_key=True, autoincrement=True)
    list_id = Column(Integer, ForeignKey("purchase_lists.list_id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=False)
    route_date = Column(Date, nullable=False)
    start_location_lat = Column(Numeric(10, 7), nullable=True)
    start_location_lng = Column(Numeric(10, 7), nullable=True)
    total_distance_km = Column(Numeric(8, 2), nullable=True)
    estimated_time_minutes = Column(Integer, nullable=True)
    route_status = Column(Enum(RouteStatus), default=RouteStatus.NOT_STARTED)
    include_return = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    purchase_list = relationship("PurchaseList", back_populates="route")
    staff = relationship("Staff", back_populates="routes")
    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan", order_by="RouteStop.stop_sequence")

    __table_args__ = (
        Index("idx_route_date", "route_date"),
        Index("idx_route_status", "route_status"),
    )


class RouteStop(Base):
    """Individual stops in a route"""
    __tablename__ = "route_stops"

    stop_id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(Integer, ForeignKey("routes.route_id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    stop_sequence = Column(Integer, nullable=False)
    estimated_arrival = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    actual_departure = Column(DateTime, nullable=True)
    items_to_purchase = Column(JSON, nullable=True)  # List of item IDs
    items_count = Column(Integer, default=0)
    stop_status = Column(Enum(StopStatus), default=StopStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    route = relationship("Route", back_populates="stops")
    store = relationship("Store", back_populates="route_stops")

    __table_args__ = (
        Index("idx_stop_sequence", "route_id", "stop_sequence"),
    )


class PurchaseFailure(Base):
    """Track failed purchases for analysis"""
    __tablename__ = "purchase_failures"

    failure_id = Column(Integer, primary_key=True, autoincrement=True)
    list_item_id = Column(Integer, ForeignKey("purchase_list_items.list_item_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("order_items.item_id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    failure_type = Column(Enum(FailureType), nullable=False)
    failure_date = Column(DateTime, default=datetime.utcnow)
    expected_restock_date = Column(Date, nullable=True)
    alternative_store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    list_item = relationship("PurchaseListItem", back_populates="failures")

    __table_args__ = (
        Index("idx_failure_date", "failure_date"),
        Index("idx_failure_type", "failure_type"),
    )


class BusinessRule(Base):
    """Configurable business rules"""
    __tablename__ = "business_rules"

    rule_id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(Enum(RuleType), nullable=False)
    rule_config = Column(JSON, nullable=False)
    priority = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CutoffSchedule(Base):
    """Daily cutoff time configuration"""
    __tablename__ = "cutoff_schedules"

    schedule_id = Column(Integer, primary_key=True, autoincrement=True)
    day_of_week = Column(Integer, nullable=True)  # 0=Monday, 6=Sunday, null=all days
    cutoff_time = Column(Time, default=time(13, 10))  # Default 13:10
    is_holiday = Column(Boolean, default=False)
    holiday_override = Column(Boolean, default=False)  # Allow processing on holidays
    effective_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class StoreDistanceMatrix(Base):
    """Pre-calculated distances between stores for route optimization"""
    __tablename__ = "store_distance_matrix"

    matrix_id = Column(Integer, primary_key=True, autoincrement=True)
    from_store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False)
    to_store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False)
    distance_km = Column(Numeric(8, 2), nullable=False)
    travel_time_minutes = Column(Integer, nullable=True)
    last_calculated = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("from_store_id", "to_store_id", name="uq_store_distance"),
        Index("idx_distance_from_store", "from_store_id"),
    )


class SystemLog(Base):
    """System audit logs"""
    __tablename__ = "system_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    log_type = Column(Enum(LogType), default=LogType.INFO)
    user_id = Column(Integer, nullable=True)
    action = Column(String(200), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_log_created", "created_at"),
        Index("idx_log_type", "log_type"),
    )


# ============================================================================
# PYDANTIC SCHEMAS (for API validation)
# ============================================================================

class OrderBase(BaseModel):
    robot_in_order_id: Optional[str] = None
    mall_name: Optional[str] = None
    customer_name: Optional[str] = None
    order_date: datetime
    target_purchase_date: Optional[date] = None


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    model_config = ConfigDict(from_attributes=True)
    
    order_id: int
    order_status: OrderStatus
    created_at: datetime
    updated_at: datetime


class OrderItemBase(BaseModel):
    sku: str
    product_name: str
    quantity: int = 1
    unit_price: Optional[Decimal] = None
    is_bundle: bool = False
    priority: str = "normal"


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    model_config = ConfigDict(from_attributes=True)
    
    item_id: int
    item_status: ItemStatus
    created_at: datetime


class StoreBase(BaseModel):
    store_name: str
    store_code: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    opening_hours: Optional[dict] = None
    category: Optional[str] = None
    priority_level: int = 2


class StoreCreate(StoreBase):
    pass


class StoreResponse(StoreBase):
    model_config = ConfigDict(from_attributes=True)
    
    store_id: int
    is_active: bool
    created_at: datetime


class StaffBase(BaseModel):
    staff_name: str
    staff_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: StaffRole = StaffRole.BUYER
    start_location_name: str = "オフィス（六本木）"
    max_daily_capacity: int = 20


class StaffCreate(StaffBase):
    password: Optional[str] = None


class StaffResponse(StaffBase):
    model_config = ConfigDict(from_attributes=True)
    
    staff_id: int
    status: StaffStatus
    is_active: bool
    current_location_name: Optional[str] = None
    created_at: datetime


class RouteStopBase(BaseModel):
    store_id: int
    stop_sequence: int
    estimated_arrival: Optional[datetime] = None
    items_count: int = 0


class RouteStopResponse(RouteStopBase):
    model_config = ConfigDict(from_attributes=True)
    
    stop_id: int
    stop_status: StopStatus


class RouteBase(BaseModel):
    route_date: date
    estimated_time_minutes: Optional[int] = None
    total_distance_km: Optional[Decimal] = None


class RouteResponse(RouteBase):
    model_config = ConfigDict(from_attributes=True)
    
    route_id: int
    list_id: int
    staff_id: int
    route_status: RouteStatus
    stops: List[RouteStopResponse] = []


class PurchaseListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    list_id: int
    staff_id: int
    purchase_date: date
    list_status: ListStatus
    total_items: int
    total_stores: int


class SettingsBase(BaseModel):
    cutoff_time: time = Field(default=time(13, 10))
    weekend_processing: bool = False
    holiday_override: bool = True
    default_start_location: str = "オフィス（六本木）"
    max_orders_per_staff: int = 20
    auto_assign: bool = True
    optimization_priority: str = "speed"  # speed, distance, cost, balanced
    max_route_time_hours: int = 4
    include_return: bool = True
