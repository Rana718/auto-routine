from datetime import date
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.schema import (
    Route, RouteStop, RouteStatus, StopStatus, Staff, PurchaseList, StaffRole,
    PurchaseListItem, OrderItem, ItemStatus, Order, OrderStatus
)
from models.routes import RouteWithDetails, RouteGenerate, StopUpdate, RouteReorder

# Default office location: Osaka central
DEFAULT_OFFICE_LAT = 34.6937
DEFAULT_OFFICE_LNG = 135.5023
DEFAULT_OFFICE_NAME = "オフィス（大阪）"

async def get_all_routes(
    db: AsyncSession,
    route_date: Optional[date],
    staff_id: Optional[int],
    status: Optional[RouteStatus],
    skip: int,
    limit: int
) -> List[RouteWithDetails]:
    from controllers.settings import extract_coordinates_from_address

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

    def get_store_coords(store):
        """Get store coordinates, auto-geocoding from address if missing."""
        if not store:
            return None, None
        lat = float(store.latitude) if store.latitude else None
        lng = float(store.longitude) if store.longitude else None
        if (lat is None or lng is None) and store.address:
            geo_lat, geo_lng = extract_coordinates_from_address(store.address)
            if geo_lat and geo_lng:
                lat = float(geo_lat)
                lng = float(geo_lng)
                # Save for future queries (committed by session)
                store.latitude = geo_lat
                store.longitude = geo_lng
        return lat, lng

    route_list = []
    for r in routes:
        stops = []
        for s in sorted(r.stops, key=lambda x: x.stop_sequence):
            store_lat, store_lng = get_store_coords(s.store)
            stops.append({
                "stop_id": s.stop_id,
                "store_id": s.store_id,
                "store_name": s.store.store_name if s.store else None,
                "store_address": s.store.address if s.store else None,
                "store_latitude": store_lat,
                "store_longitude": store_lng,
                "stop_sequence": s.stop_sequence,
                "stop_status": s.stop_status.value,
                "items_count": s.items_count,
                "estimated_arrival": s.estimated_arrival.isoformat() if s.estimated_arrival else None,
            })

        route_list.append(
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
                start_location_lat=float(r.start_location_lat) if r.start_location_lat else (float(r.staff.start_location_lat) if r.staff and r.staff.start_location_lat else DEFAULT_OFFICE_LAT),
                start_location_lng=float(r.start_location_lng) if r.start_location_lng else (float(r.staff.start_location_lng) if r.staff and r.staff.start_location_lng else DEFAULT_OFFICE_LNG),
                start_location_name=(r.staff.start_location_name if r.staff and r.staff.start_location_name else DEFAULT_OFFICE_NAME),
                stops=stops,
            )
        )

    return route_list

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

    from services.route_optimization import generate_route_for_staff
    route_id = await generate_route_for_staff(
        db, data.staff_id, purchase_list.purchase_date, data.optimization_priority
    )

    if not route_id:
        raise HTTPException(
            status_code=400,
            detail="ルート生成に失敗しました（購入アイテムがありません）"
        )

    return {
        "message": "ルートを生成しました",
        "route_id": route_id,
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
    old_status = stop.stop_status
    stop.stop_status = StopStatus(update.stop_status)
    
    # If stop is marked as completed, update related items and orders
    if stop.stop_status == StopStatus.COMPLETED and old_status != StopStatus.COMPLETED:
        # Get the purchase list for this route
        result = await db.execute(
            select(PurchaseList)
            .where(PurchaseList.list_id == route.list_id)
        )
        purchase_list = result.scalar_one_or_none()
        
        if purchase_list:
            # Get all purchase list items for this store
            result = await db.execute(
                select(PurchaseListItem)
                .where(PurchaseListItem.list_id == purchase_list.list_id)
                .where(PurchaseListItem.store_id == stop.store_id)
            )
            purchase_items = result.scalars().all()
            
            # Update all related order items to PURCHASED
            for purchase_item in purchase_items:
                if purchase_item.item_id:
                    result = await db.execute(
                        select(OrderItem)
                        .where(OrderItem.item_id == purchase_item.item_id)
                    )
                    order_item = result.scalar_one_or_none()
                    if order_item and order_item.item_status != ItemStatus.PURCHASED:
                        order_item.item_status = ItemStatus.PURCHASED
            
            # Check and update order completion status
            result = await db.execute(
                select(Order)
                .join(OrderItem)
                .join(PurchaseListItem, PurchaseListItem.item_id == OrderItem.item_id)
                .where(PurchaseListItem.store_id == stop.store_id)
                .where(PurchaseListItem.list_id == purchase_list.list_id)
                .distinct()
            )
            orders = result.scalars().all()
            
            for order in orders:
                # Get all items for this order
                result = await db.execute(
                    select(OrderItem)
                    .where(OrderItem.order_id == order.order_id)
                )
                all_items = result.scalars().all()
                
                if all_items:
                    purchased_count = sum(1 for item in all_items if item.item_status == ItemStatus.PURCHASED)
                    total_count = len(all_items)
                    
                    if purchased_count == total_count:
                        order.order_status = OrderStatus.COMPLETED
                    elif purchased_count > 0:
                        order.order_status = OrderStatus.PARTIALLY_COMPLETED
    
    # Check if all stops in the route are completed
    if stop.stop_status == StopStatus.COMPLETED:
        result = await db.execute(
            select(RouteStop)
            .where(RouteStop.route_id == route_id)
        )
        all_stops = result.scalars().all()
        
        if all_stops:
            completed_stops = sum(1 for s in all_stops if s.stop_status == StopStatus.COMPLETED)
            if completed_stops == len(all_stops):
                route.route_status = RouteStatus.COMPLETED
    
    await db.flush()
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
    
    await db.flush()
    return {"message": f"{len(routes)}件のルートを開始しました", "count": len(routes)}

async def reorder_route_stops_controller(db: AsyncSession, route_id: int, reorder: RouteReorder, current_user: Staff):
    """Reorder route stops with RBAC:
    - ADMIN: Full access
    - SUPERVISOR: Can edit all routes
    - BUYER: Can edit their own routes only
    """
    # Get route with stops
    result = await db.execute(
        select(Route)
        .options(selectinload(Route.stops))
        .where(Route.route_id == route_id)
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="ルートが見つかりません")
    
    # Check permissions
    is_admin = current_user.role == StaffRole.ADMIN
    is_supervisor = current_user.role == StaffRole.SUPERVISOR
    is_assigned_buyer = current_user.role == StaffRole.BUYER and route.staff_id == current_user.staff_id
    
    if not (is_admin or is_supervisor or is_assigned_buyer):
        raise HTTPException(
            status_code=403, 
            detail="このルートを編集する権限がありません"
        )
    
    # Validate stop_ids
    existing_stop_ids = {stop.stop_id for stop in route.stops}
    provided_stop_ids = set(reorder.stop_ids)
    
    if existing_stop_ids != provided_stop_ids:
        raise HTTPException(
            status_code=400,
            detail="提供されたstop_idsがルートの既存のストップと一致しません"
        )
    
    # Update stop sequences
    for new_sequence, stop_id in enumerate(reorder.stop_ids, start=1):
        result = await db.execute(
            select(RouteStop)
            .where(RouteStop.route_id == route_id)
            .where(RouteStop.stop_id == stop_id)
        )
        stop = result.scalar_one_or_none()
        if stop:
            stop.stop_sequence = new_sequence
    
    await db.flush()
    return {"message": "ルートを並び替えました"}

