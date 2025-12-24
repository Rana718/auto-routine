from pydantic import BaseModel
from typing import Optional
from datetime import date

class PurchaseFailureCreate(BaseModel):
    list_item_id: int
    item_id: int
    store_id: int
    failure_type: str  # discontinued, out_of_stock, store_closed, etc.
    expected_restock_date: Optional[date] = None
    alternative_store_id: Optional[int] = None
    notes: Optional[str] = None
