"""
Routes API routes (for route planning and optimization)
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.db import get_db
from db.schema import (
    Route, RouteStop, RouteStatus, StopStatus, Staff, Store, PurchaseList,
    RouteResponse, RouteStopResponse
)

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class RouteWithDetails(BaseModel):
    route_id: int
    staff_id: int
    staff_name: str
    staff_avatar: str
    route_date: date
    route_status: RouteStatus
    total_stops: int
    completed_stops: int
    estimated_duration: str
    stops: List[dict] = []


class RouteGenerate(BaseModel):
    staff_id: int
    list_id: int
    optimization_priority: str = "speed"  # speed, distance, cost


class StopUpdate(BaseModel):
    stop_status: StopStatus
    actual_arrival: Optional[str] = None
    actual_departure: Optional[str] = None


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/", response_model=List[RouteWithDetails])
async def get_routes(
    db: AsyncSession = Depends(get_db),
    route_date: Optional[date] = None,
    staff_id: Optional[int] = None,
    status: Optional[RouteStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all routes with optional filters"""
    query = (
        select(Route)
        .options(selectinload(Route.stops), selectinload(Route.staff))
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


@router.get("/{route_id}")
async def get_route(
    route_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get single route with full details"""
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


@router.post("/generate")
async def generate_route(
    data: RouteGenerate,
    db: AsyncSession = Depends(get_db),
):
    """Generate optimized route for a purchase list"""
    # Verify staff exists
    result = await db.execute(select(Staff).where(Staff.staff_id == data.staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    # Verify purchase list exists
    result = await db.execute(select(PurchaseList).where(PurchaseList.list_id == data.list_id))
    purchase_list = result.scalar_one_or_none()
    if not purchase_list:
        raise HTTPException(status_code=404, detail="買付リストが見つかりません")
    
    # TODO: Implement route optimization algorithm
    # For now, create a simple route
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


@router.post("/regenerate-all")
async def regenerate_all_routes(
    route_date: date = None,
    db: AsyncSession = Depends(get_db),
):
    """Regenerate all routes for a given date"""
    target_date = route_date or date.today()
    
    # TODO: Implement bulk route regeneration
    return {
        "message": f"{target_date}のルートを再生成しました",
        "routes_count": 0,
    }


@router.patch("/{route_id}/status")
async def update_route_status(
    route_id: int,
    status: RouteStatus,
    db: AsyncSession = Depends(get_db),
):
    """Update route status"""
    result = await db.execute(select(Route).where(Route.route_id == route_id))
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="ルートが見つかりません")
    
    route.route_status = status
    
    return {"message": "ステータスを更新しました", "new_status": status.value}


@router.patch("/{route_id}/stops/{stop_id}")
async def update_stop(
    route_id: int,
    stop_id: int,
    update: StopUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update individual stop status"""
    result = await db.execute(
        select(RouteStop)
        .where(RouteStop.route_id == route_id)
        .where(RouteStop.stop_id == stop_id)
    )
    stop = result.scalar_one_or_none()
    
    if not stop:
        raise HTTPException(status_code=404, detail="ストップが見つかりません")
    
    stop.stop_status = update.stop_status
    
    return {"message": "ストップを更新しました", "new_status": update.stop_status.value}


@router.post("/start-all")
async def start_all_routes(
    route_date: date = None,
    db: AsyncSession = Depends(get_db),
):
    """Start all routes for today"""
    target_date = route_date or date.today()
    
    result = await db.execute(
        select(Route)
        .where(Route.route_date == target_date)
        .where(Route.route_status == RouteStatus.NOT_STARTED)
    )
    routes = result.scalars().all()
    
    for route in routes:
        route.route_status = RouteStatus.IN_PROGRESS
    
    return {"message": f"{len(routes)}件のルートを開始しました", "count": len(routes)}
