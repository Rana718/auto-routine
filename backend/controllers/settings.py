from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import BusinessRule, RuleType
from models.settings import AllSettings, CutoffSettings, StaffSettings, RouteSettings, NotificationSettings

async def get_all_settings(db: AsyncSession) -> AllSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.is_active == True))
    rules = result.scalars().all()
    
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

async def update_cutoff_settings_controller(db: AsyncSession, settings: CutoffSettings) -> CutoffSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.rule_type == RuleType.CUTOFF))
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

async def update_staff_settings_controller(db: AsyncSession, settings: StaffSettings) -> StaffSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.rule_type == RuleType.ASSIGNMENT))
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

async def update_route_settings_controller(db: AsyncSession, settings: RouteSettings) -> RouteSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.rule_type == RuleType.ROUTING))
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

async def update_notification_settings_controller(db: AsyncSession, settings: NotificationSettings) -> NotificationSettings:
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

async def import_stores_controller(db: AsyncSession):
    return {"message": "店舗データをインポートしました", "count": 0}

async def export_orders_controller(db: AsyncSession):
    return {"message": "注文データをエクスポートしました"}

async def create_backup_controller(db: AsyncSession):
    return {"message": "バックアップを作成しました"}
