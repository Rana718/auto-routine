from pydantic import BaseModel
from typing import Optional

class StaffStats(BaseModel):
    total_staff: int
    active_today: int
    en_route: int
    completed_orders: int

class StaffWithStats(BaseModel):
    staff_id: int
    staff_name: str
    staff_code: Optional[str] = None
    email: Optional[str] = None
    role: str
    status: str
    is_active: bool
    assigned_orders: int = 0
    assigned_stores: int = 0
    completed_today: int = 0
    current_location_name: Optional[str] = None

class StaffStatusUpdate(BaseModel):
    status: str
    current_location_lat: Optional[float] = None
    current_location_lng: Optional[float] = None
    current_location_name: Optional[str] = None
