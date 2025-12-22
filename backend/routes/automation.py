from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from middlewares.auth import get_current_user

router = APIRouter()

@router.post("/auto-assign")
async def auto_assign_daily_orders(
    target_date: date,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Auto-assign pending orders to available staff for target date"""
    from services.staff_assignment import auto_assign_daily_orders as assign_orders
    
    result = await assign_orders(db, target_date)
    await db.commit()
    return result

@router.post("/generate-routes")
async def generate_all_routes(
    target_date: date,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Generate optimized routes for all purchase lists on target date"""
    from services.route_optimization import generate_all_routes_for_date
    
    route_ids = await generate_all_routes_for_date(db, target_date)
    await db.commit()
    
    return {
        "message": f"{len(route_ids)}件のルートを生成しました",
        "route_ids": route_ids
    }
