from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from models.settings import AllSettings, CutoffSettings, StaffSettings, RouteSettings, NotificationSettings
from controllers.settings import *
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=AllSettings)
async def get_settings(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_all_settings(db)

@router.put("/cutoff", response_model=CutoffSettings)
async def update_cutoff_settings(
    settings: CutoffSettings,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_cutoff_settings_controller(db, settings)

@router.put("/staff", response_model=StaffSettings)
async def update_staff_settings(
    settings: StaffSettings,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_staff_settings_controller(db, settings)

@router.put("/route", response_model=RouteSettings)
async def update_route_settings(
    settings: RouteSettings,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_route_settings_controller(db, settings)

@router.put("/notification", response_model=NotificationSettings)
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_notification_settings_controller(db, settings)

@router.post("/data/import-stores")
async def import_stores(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await import_stores_controller(db)

@router.get("/data/export-orders")
async def export_orders(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    from fastapi.responses import Response
    csv_data = await export_orders_controller(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders_export.csv"}
    )

@router.post("/data/backup")
async def create_backup(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await create_backup_controller(db)
