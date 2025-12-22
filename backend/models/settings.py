from pydantic import BaseModel

class CutoffSettings(BaseModel):
    cutoff_time: str = "13:10"
    weekend_processing: bool = False
    holiday_override: bool = True

class StaffSettings(BaseModel):
    default_start_location: str = "オフィス（六本木）"
    max_orders_per_staff: int = 20
    auto_assign: bool = True

class RouteSettings(BaseModel):
    optimization_priority: str = "speed"
    max_route_time_hours: int = 4
    include_return: bool = True

class NotificationSettings(BaseModel):
    cutoff_warning: bool = True
    order_failure_alert: bool = True
    route_completion_notification: bool = False

class AllSettings(BaseModel):
    cutoff: CutoffSettings = CutoffSettings()
    staff: StaffSettings = StaffSettings()
    route: RouteSettings = RouteSettings()
    notification: NotificationSettings = NotificationSettings()
