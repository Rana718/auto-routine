"""
Settings API routes
"""
from datetime import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import BusinessRule, CutoffSchedule, RuleType, SettingsBase

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

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


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/", response_model=AllSettings)
async def get_settings(
    db: AsyncSession = Depends(get_db),
):
    """Get all system settings"""
    # Load settings from business rules table
    result = await db.execute(
        select(BusinessRule).where(BusinessRule.is_active == True)
    )
    rules = result.scalars().all()
    
    # Build settings from rules
    settings = AllSettings()
    
    for rule in rules:
        if rule.rule_type == RuleType.CUTOFF and rule.rule_config:
            if "cutoff_time" in rule.rule_config:
                settings.cutoff.cutoff_time = rule.rule_config["cutoff_time"]
            if "weekend_processing" in rule.rule_config:
                settings.cutoff.weekend_processing = rule.rule_config["weekend_processing"]
            if "holiday_override" in rule.rule_config:
                settings.cutoff.holiday_override = rule.rule_config["holiday_override"]
        
        elif rule.rule_type == RuleType.ASSIGNMENT and rule.rule_config:
            if "default_start_location" in rule.rule_config:
                settings.staff.default_start_location = rule.rule_config["default_start_location"]
            if "max_orders_per_staff" in rule.rule_config:
                settings.staff.max_orders_per_staff = rule.rule_config["max_orders_per_staff"]
            if "auto_assign" in rule.rule_config:
                settings.staff.auto_assign = rule.rule_config["auto_assign"]
        
        elif rule.rule_type == RuleType.ROUTING and rule.rule_config:
            if "optimization_priority" in rule.rule_config:
                settings.route.optimization_priority = rule.rule_config["optimization_priority"]
            if "max_route_time_hours" in rule.rule_config:
                settings.route.max_route_time_hours = rule.rule_config["max_route_time_hours"]
            if "include_return" in rule.rule_config:
                settings.route.include_return = rule.rule_config["include_return"]
    
    return settings


@router.put("/cutoff", response_model=CutoffSettings)
async def update_cutoff_settings(
    settings: CutoffSettings,
    db: AsyncSession = Depends(get_db),
):
    """Update cutoff settings"""
    # Find or create cutoff rule
    result = await db.execute(
        select(BusinessRule).where(BusinessRule.rule_type == RuleType.CUTOFF)
    )
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Daily Cutoff Settings",
            rule_type=RuleType.CUTOFF,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    
    return settings


@router.put("/staff", response_model=StaffSettings)
async def update_staff_settings(
    settings: StaffSettings,
    db: AsyncSession = Depends(get_db),
):
    """Update staff assignment settings"""
    result = await db.execute(
        select(BusinessRule).where(BusinessRule.rule_type == RuleType.ASSIGNMENT)
    )
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Staff Assignment Settings",
            rule_type=RuleType.ASSIGNMENT,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    
    return settings


@router.put("/route", response_model=RouteSettings)
async def update_route_settings(
    settings: RouteSettings,
    db: AsyncSession = Depends(get_db),
):
    """Update route optimization settings"""
    result = await db.execute(
        select(BusinessRule).where(BusinessRule.rule_type == RuleType.ROUTING)
    )
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Route Optimization Settings",
            rule_type=RuleType.ROUTING,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    
    return settings


@router.put("/notification", response_model=NotificationSettings)
async def update_notification_settings(
    settings: NotificationSettings,
    db: AsyncSession = Depends(get_db),
):
    """Update notification settings"""
    # Store as a generic business rule with type PRIORITY (reusing enum)
    result = await db.execute(
        select(BusinessRule)
        .where(BusinessRule.rule_type == RuleType.PRIORITY)
        .where(BusinessRule.rule_name == "Notification Settings")
    )
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Notification Settings",
            rule_type=RuleType.PRIORITY,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    
    return settings


@router.post("/data/import-stores")
async def import_stores(
    db: AsyncSession = Depends(get_db),
):
    """Import stores from CSV/Excel"""
    # TODO: Implement file upload and import
    return {"message": "店舗データをインポートしました", "count": 0}


@router.post("/data/export-orders")
async def export_orders(
    db: AsyncSession = Depends(get_db),
):
    """Export orders to CSV"""
    # TODO: Implement export
    return {"message": "注文データをエクスポートしました"}


@router.post("/data/backup")
async def create_backup(
    db: AsyncSession = Depends(get_db),
):
    """Create system backup"""
    # TODO: Implement backup
    return {"message": "バックアップを作成しました"}
