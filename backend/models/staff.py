from pydantic import BaseModel
from typing import Optional

class StaffUpdate(BaseModel):
    staff_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    max_daily_capacity: Optional[int] = None

class StaffRoleUpdate(BaseModel):
    role: str  # "buyer", "supervisor", "admin"

class StaffStats(BaseModel):
    total_staff: int
    active_staff: int
    on_duty_staff: int
    total_capacity: int

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
