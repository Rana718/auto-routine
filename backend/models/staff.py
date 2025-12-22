from typing import Optional
from pydantic import BaseModel
from db.schema import StaffStatus

class StaffStats(BaseModel):
    total_staff: int
    active_today: int
    en_route: int
    completed_orders: int

class StaffWithStats(BaseModel):
    staff_id: int
    staff_name: str
    staff_code: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    role: str
    status: StaffStatus
    assigned_orders: int = 0
    assigned_stores: int = 0
    completed_today: int = 0

class StaffStatusUpdate(BaseModel):
    status: StaffStatus
    current_location_name: Optional[str] = None
    current_location_lat: Optional[float] = None
    current_location_lng: Optional[float] = None
