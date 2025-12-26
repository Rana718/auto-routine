from datetime import date
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.schema import Route, RouteStop, RouteStatus, StopStatus, Staff, PurchaseList
from models.routes import RouteWithDetails, RouteGenerate, StopUpdate

async def get_all_routes(
    db: AsyncSession,
    route_date: Optional[date],
    staff_id: Optional[int],
    status: Optional[RouteStatus],
    skip: int,
    limit: int
) -> List[RouteWithDetails]:
    from db.schema import Store
    
    query = select(Route).options(
        selectinload(Route.stops).selectinload(RouteStop.store),
        selectinload(Route.staff)
    )
    
    if route_date:
        query = query.where(Route.route_date == route_date)
    if staff_id:
        query = query.where(Route.staff_id == staff_id)
    if status:
        query = query.where(Route.route_status == status)
    
    query = query.order_by(Route.route_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    routes = result.scalars().all()
    
    return [
        RouteWithDetails(
            route_id=r.route_id,
            staff_id=r.staff_id,
            staff_name=r.staff.staff_name if r.staff else "Unknown",
            staff_avatar=r.staff.staff_name[0] if r.staff else "?",
            route_date=r.route_date,
            route_status=r.route_status,
            total_stops=len(r.stops),
            completed_stops=sum(1 for s in r.stops if s.stop_status == StopStatus.COMPLETED),
            estimated_duration=f"{r.estimated_time_minutes or 0}分",
            stops=[
                {
                    "stop_id": s.stop_id,
                    "store_id": s.store_id,
                    "store_name": s.store.store_name if s.store else None,
                    "store_address": s.store.address if s.store else None,
                    "store_latitude": float(s.store.latitude) if s.store and s.store.latitude else None,
                    "store_longitude": float(s.store.longitude) if s.store and s.store.longitude else None,
                    "stop_sequence": s.stop_sequence,
                    "stop_status": s.stop_status.value,
                    "items_count": s.items_count,
                    "estimated_arrival": s.estimated_arrival.isoformat() if s.estimated_arrival else None,
                }
                for s in sorted(r.stops, key=lambda x: x.stop_sequence)
            ],
        )
        for r in routes
    ]

async def get_route_by_id(db: AsyncSession, route_id: int):
    result = await db.execute(
        select(Route)
        .options(selectinload(Route.stops).selectinload(RouteStop.store))
        .options(selectinload(Route.staff))
        .where(Route.route_id == route_id)
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="ルートが見つかりません")
    
    return {
        "route_id": route.route_id,
        "staff_id": route.staff_id,
        "staff_name": route.staff.staff_name if route.staff else "Unknown",
        "route_date": route.route_date,
        "route_status": route.route_status.value,
        "total_distance_km": float(route.total_distance_km) if route.total_distance_km else None,
        "estimated_time_minutes": route.estimated_time_minutes,
        "include_return": route.include_return,
        "stops": [
            {
                "stop_id": s.stop_id,
                "store_id": s.store_id,
                "store_name": s.store.store_name if s.store else "Unknown",
                "store_address": s.store.address if s.store else None,
                "stop_sequence": s.stop_sequence,
                "stop_status": s.stop_status.value,
                "items_count": s.items_count,
                "estimated_arrival": s.estimated_arrival.isoformat() if s.estimated_arrival else None,
                "actual_arrival": s.actual_arrival.isoformat() if s.actual_arrival else None,
                "actual_departure": s.actual_departure.isoformat() if s.actual_departure else None,
            }
            for s in sorted(route.stops, key=lambda x: x.stop_sequence)
        ],
    }

async def generate_route_controller(db: AsyncSession, data: RouteGenerate):
    result = await db.execute(select(Staff).where(Staff.staff_id == data.staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    result = await db.execute(select(PurchaseList).where(PurchaseList.list_id == data.list_id))
    purchase_list = result.scalar_one_or_none()
    if not purchase_list:
        raise HTTPException(status_code=404, detail="買付リストが見つかりません")
    
    route = Route(
        list_id=data.list_id,
        staff_id=data.staff_id,
        route_date=purchase_list.purchase_date,
        start_location_lat=staff.start_location_lat,
        start_location_lng=staff.start_location_lng,
        route_status=RouteStatus.NOT_STARTED,
    )
    db.add(route)
    await db.flush()
    await db.refresh(route)
    
    return {
        "message": "ルートを生成しました",
        "route_id": route.route_id,
        "optimization": data.optimization_priority,
    }

async def regenerate_all_routes_controller(db: AsyncSession, route_date: date = None):
    from services.route_optimization import generate_all_routes_for_date
    
    target_date = route_date or date.today()
    route_ids = await generate_all_routes_for_date(db, target_date)
    return {
        "message": f"{target_date}の{len(route_ids)}件のルートを再生成しました", 
        "routes_count": len(route_ids),
        "route_ids": route_ids,
    }

async def update_route_status_controller(db: AsyncSession, route_id: int, status: RouteStatus):
    result = await db.execute(select(Route).where(Route.route_id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="ルートが見つかりません")
    
    route.route_status = status
    return {"message": "ステータスを更新しました", "new_status": status.value}

async def update_stop_controller(db: AsyncSession, route_id: int, stop_id: int, update: StopUpdate, current_user_id: int = None):
    result = await db.execute(
        select(RouteStop)
        .where(RouteStop.route_id == route_id)
        .where(RouteStop.stop_id == stop_id)
    )
    stop = result.scalar_one_or_none()
    if not stop:
        raise HTTPException(status_code=404, detail="ストップが見つかりません")
    
    # Get route to check staff assignment
    result = await db.execute(select(Route).where(Route.route_id == route_id))
    route = result.scalar_one_or_none()
    
    # Permission check: only assigned staff or supervisors/admins can update
    if current_user_id and route:
        result = await db.execute(select(Staff).where(Staff.staff_id == current_user_id))
        current_user = result.scalar_one_or_none()
        
        if current_user:
            from db.schema import StaffRole
            is_assigned_staff = route.staff_id == current_user_id
            is_supervisor_or_admin = current_user.role in [StaffRole.SUPERVISOR, StaffRole.ADMIN]
            
            if not (is_assigned_staff or is_supervisor_or_admin):
                raise HTTPException(status_code=403, detail="このルートを更新する権限がありません")
    
    # Convert string to StopStatus enum
    from db.schema import StopStatus
    stop.stop_status = StopStatus(update.stop_status)
    await db.commit()
    return {"message": "ストップを更新しました", "new_status": update.stop_status}

async def start_all_routes_controller(db: AsyncSession, route_date: date = None):
    target_date = route_date or date.today()
    result = await db.execute(
        select(Route)
        .where(Route.route_date == target_date)
        .where(Route.route_status == RouteStatus.NOT_STARTED)
    )
    routes = result.scalars().all()
    
    for route in routes:
        route.route_status = RouteStatus.IN_PROGRESS
    
    await db.commit()
    return {"message": f"{len(routes)}件のルートを開始しました", "count": len(routes)}
