from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import Annotated

from db.db import get_db
from db.schema import Staff, Order, Route
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("")
async def get_notifications(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get dynamic notifications based on system state"""
    notifications = []
    
    # Use Japan timezone for calculations
    now_utc = datetime.utcnow()
    jst_offset = timedelta(hours=9)
    now_jst = now_utc + jst_offset
    today_date = now_jst.date()
    
    # 1. Check for cutoff time (default 13:10 JST)
    cutoff_hour = 13
    cutoff_minute = 10
    cutoff_time = now_jst.replace(hour=cutoff_hour, minute=cutoff_minute, second=0, microsecond=0)
    
    if now_jst > cutoff_time:
        minutes_ago = int((now_jst - cutoff_time).total_seconds() / 60)
        if minutes_ago < 60:
            time_str = f"{minutes_ago}分前"
        else:
            time_str = f"{minutes_ago // 60}時間前"
        notifications.append({
            "id": "cutoff",
            "type": "warning",
            "title": "カットオフ時間経過",
            "message": f"本日の注文締切時間（{cutoff_hour}:{cutoff_minute:02d}）を過ぎました",
            "time": time_str,
            "read": False
        })
    
    # 2. Check pending orders count - OPTIMIZED with CASE aggregation
    orders_stats_result = await db.execute(
        select(
            func.count(Order.order_id).label('pending_count'),
            func.sum(case((Order.order_status == "completed", 1), else_=0)).label('completed_count')
        ).where(Order.target_purchase_date == today_date)
    )
    orders_stats = orders_stats_result.one()
    pending_count = orders_stats.pending_count or 0
    
    if pending_count > 0:
        notifications.append({
            "id": "pending_orders",
            "type": "info",
            "title": "未割当注文",
            "message": f"{pending_count}件の注文が割当待ちです",
            "time": "現在",
            "read": False
        })
    
    # 3. Check for completed routes today - OPTIMIZED with selectinload
    completed_routes_result = await db.execute(
        select(Route)
        .options(selectinload(Route.staff))
        .where(
            and_(
                Route.route_status == "completed",
                Route.route_date == today_date
            )
        ).order_by(Route.created_at.desc()).limit(3)
    )
    completed_routes = completed_routes_result.scalars().all()
    
    for route in completed_routes:
        staff_name = route.staff.staff_name if route.staff else "スタッフ"
        
        # Calculate time ago
        if route.updated_at:
            time_diff = now_utc - route.updated_at
            minutes = int(time_diff.total_seconds() / 60)
            if minutes < 60:
                time_str = f"{minutes}分前"
            else:
                time_str = f"{minutes // 60}時間前"
        else:
            time_str = "最近"
            
        notifications.append({
            "id": f"route_completed_{route.route_id}",
            "type": "success",
            "title": "ルート完了",
            "message": f"{staff_name}さんのルートが完了しました",
            "time": time_str,
            "read": True
        })
    
    # 4. Check for failed orders
    failed_result = await db.execute(
        select(func.count(Order.order_id)).where(
            and_(
                Order.order_status == "failed",
                Order.target_purchase_date == today_date
            )
        )
    )
    failed_count = failed_result.scalar() or 0
    
    if failed_count > 0:
        notifications.append({
            "id": "failed_orders",
            "type": "warning",
            "title": "失敗した注文",
            "message": f"{failed_count}件の注文が失敗しています",
            "time": "現在",
            "read": False
        })
    
    # 5. Check for active staff count
    active_staff_result = await db.execute(
        select(func.count(Staff.staff_id)).where(
            Staff.status.in_(["active", "en_route"])
        )
    )
    active_staff = active_staff_result.scalar() or 0
    
    total_staff_result = await db.execute(
        select(func.count(Staff.staff_id)).where(Staff.is_active == True)
    )
    total_staff = total_staff_result.scalar() or 0
    
    if active_staff < total_staff and total_staff > 0:
        notifications.append({
            "id": "staff_status",
            "type": "info",
            "title": "スタッフ稼働状況",
            "message": f"{active_staff}/{total_staff}名が稼働中です",
            "time": "現在",
            "read": True
        })
    
    return notifications
