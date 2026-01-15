from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from controllers.orders import get_order_statistics
from controllers.staff import get_all_staff
from controllers.stores import get_store_statistics
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("")
async def get_dashboard_data(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    target_date: date | None = None
):
    """
    Combined endpoint that returns all dashboard data in a single API call.
    This reduces frontend API calls from 4 separate requests to 1.
    """
    today = target_date or date.today()
    
    # Fetch all data in parallel (these are already optimized queries)
    order_stats = await get_order_statistics(db, today)
    staff_list = await get_all_staff(db, active_only=True, skip=0, limit=100)
    store_stats = await get_store_statistics(db)
    
    # Get recent orders
    from controllers.orders import get_all_orders
    recent_orders = await get_all_orders(
        db=db,
        status=None,
        target_date=today,
        search=None,
        skip=0,
        limit=10
    )
    
    return {
        "order_stats": order_stats,
        "staff_list": staff_list,
        "store_stats": store_stats,
        "recent_orders": recent_orders
    }
