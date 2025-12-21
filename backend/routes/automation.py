from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from middlewares.auth import get_current_user
from utils.staff_assignment import auto_assign_orders_to_staff
from utils.route_optimization import generate_optimized_route

router = APIRouter()

@router.post("/auto-assign")
async def auto_assign_daily_orders(
    target_date: date,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Auto-assign pending orders to available staff for target date"""
    result = await auto_assign_orders_to_staff(db, target_date)
    await db.commit()
    return result

@router.post("/generate-routes")
async def generate_all_routes(
    target_date: date,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Generate optimized routes for all purchase lists on target date"""
    from sqlalchemy import select
    from db.schema import PurchaseList
    
    result = await db.execute(
        select(PurchaseList).where(PurchaseList.purchase_date == target_date)
    )
    lists = result.scalars().all()
    
    generated_routes = []
    for plist in lists:
        route_id = await generate_optimized_route(db, plist.list_id, plist.staff_id)
        if route_id:
            generated_routes.append(route_id)
    
    await db.commit()
    
    return {
        "message": f"Generated {len(generated_routes)} routes",
        "route_ids": generated_routes
    }
