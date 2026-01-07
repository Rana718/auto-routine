from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from models.settings import AllSettings, CutoffSettings, StaffSettings, RouteSettings, NotificationSettings
from controllers.settings import *
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("", response_model=AllSettings)
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
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Export orders as CSV - accepts token as query parameter for direct URL access"""
    from fastapi.responses import Response
    from fastapi import HTTPException
    from datetime import datetime
    import base64
    import json
    
    # Validate token manually since this endpoint uses query param auth
    try:
        payload = json.loads(base64.b64decode(token))
        staff_id = payload.get("staff_id")
        exp = datetime.fromisoformat(payload.get("exp"))
        
        if datetime.utcnow() > exp:
            raise HTTPException(status_code=401, detail="Token expired")
        
        from sqlalchemy import select
        result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        # Check if user has permission (admin or supervisor)
        if user.role not in ["admin", "supervisor"]:
            raise HTTPException(status_code=403, detail="Permission denied")
            
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
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


@router.post("/data/calculate-distances")
async def calculate_distances(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Pre-calculate store distance matrix for route optimization"""
    from services.distance_matrix import calculate_store_distance_matrix
    
    count = await calculate_store_distance_matrix(db)
    return {"message": f"{count}件の距離を計算しました", "calculated_pairs": count}
