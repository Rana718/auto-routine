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
    """
    Generate optimized routes for all purchase lists on target date.
    This combines: auto-assign → generate routes → start routes
    """
    from services.staff_assignment import auto_assign_daily_orders as assign_orders
    from services.route_optimization import generate_all_routes_for_date
    from db.schema import Route, RouteStatus
    from sqlalchemy import select

    # Step 1: Auto-assign pending orders to staff
    assign_result = await assign_orders(db, target_date)
    assigned_count = assign_result.get("assigned_count", 0)

    # Step 2: Generate optimized routes
    route_ids = await generate_all_routes_for_date(db, target_date)

    # Step 3: Auto-start all generated routes
    if route_ids:
        result = await db.execute(
            select(Route).where(Route.route_id.in_(route_ids))
        )
        routes = result.scalars().all()
        for route in routes:
            if route.route_status == RouteStatus.NOT_STARTED:
                route.route_status = RouteStatus.IN_PROGRESS

    await db.commit()

    return {
        "message": f"{assigned_count}件を割り当て、{len(route_ids)}件のルートを生成しました",
        "assigned_count": assigned_count,
        "route_ids": route_ids
    }
