from datetime import date
from typing import List, Optional
from pydantic import BaseModel
from db.schema import RouteStatus, StopStatus

class RouteWithDetails(BaseModel):
    route_id: int
    staff_id: int
    staff_name: str
    staff_avatar: str
    route_date: date
    route_status: RouteStatus
    total_stops: int
    completed_stops: int
    estimated_duration: str
    stops: List[dict] = []

class RouteGenerate(BaseModel):
    staff_id: int
    list_id: int
    optimization_priority: str = "speed"

class StopUpdate(BaseModel):
    stop_status: StopStatus
    actual_arrival: Optional[str] = None
    actual_departure: Optional[str] = None
