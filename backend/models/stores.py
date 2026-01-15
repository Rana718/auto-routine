from typing import Optional
from pydantic import BaseModel

class StoreStats(BaseModel):
    total_stores: int
    active_stores: int
    stores_with_orders: int
    total_orders_today: int

class StoreWithOrders(BaseModel):
    store_id: int
    store_name: str
    store_code: Optional[str]
    address: Optional[str]
    district: Optional[str]
    category: Optional[str]
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    opening_hours: Optional[dict] = None
    priority_level: int = 1
    is_active: bool = True
    orders_today: int = 0

class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    category: Optional[str] = None
    opening_hours: Optional[dict] = None
    priority_level: Optional[int] = None
    is_active: Optional[bool] = None
