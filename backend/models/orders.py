from datetime import date
from typing import List, Optional
from pydantic import BaseModel
from db.schema import OrderStatus

class OrderWithItemsResponse(BaseModel):
    order_id: int
    robot_in_order_id: Optional[str]
    mall_name: Optional[str]
    customer_name: Optional[str]
    order_date: date
    order_status: OrderStatus
    target_purchase_date: Optional[date]
    items: List[dict] = []

class OrderStats(BaseModel):
    total_orders: int
    pending_orders: int
    assigned_orders: int
    completed_orders: int
    failed_orders: int

class BulkOrderImport(BaseModel):
    orders: List[dict]
