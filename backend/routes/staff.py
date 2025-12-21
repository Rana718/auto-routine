"""
Staff API routes
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import (
    Staff, StaffRole, StaffStatus, PurchaseList, ListStatus,
    StaffCreate, StaffResponse
)

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class StaffStats(BaseModel):
    total_staff: int
    active_today: int
    en_route: int
    completed_orders: int


class StaffWithStats(StaffResponse):
    assigned_orders: int = 0
    assigned_stores: int = 0
    completed_today: int = 0


class StaffStatusUpdate(BaseModel):
    status: StaffStatus
    current_location_name: Optional[str] = None
    current_location_lat: Optional[float] = None
    current_location_lng: Optional[float] = None


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/", response_model=List[StaffWithStats])
async def get_staff(
    db: AsyncSession = Depends(get_db),
    active_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all staff members"""
    query = select(Staff)
    
    if active_only:
        query = query.where(Staff.is_active == True)
    
    query = query.order_by(Staff.staff_name).offset(skip).limit(limit)
    result = await db.execute(query)
    staff_list = result.scalars().all()
    
    # TODO: Add actual counts from purchase lists
    return [
        StaffWithStats(
            staff_id=s.staff_id,
            staff_name=s.staff_name,
            staff_code=s.staff_code,
            email=s.email,
            phone=s.phone,
            role=s.role,
            status=s.status,
            start_location_name=s.start_location_name,
            max_daily_capacity=s.max_daily_capacity,
            is_active=s.is_active,
            current_location_name=s.current_location_name,
            created_at=s.created_at,
            assigned_orders=0,
            assigned_stores=0,
            completed_today=0,
        )
        for s in staff_list
    ]


@router.get("/stats", response_model=StaffStats)
async def get_staff_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get staff statistics for dashboard"""
    # Total active staff
    result = await db.execute(
        select(func.count(Staff.staff_id)).where(Staff.is_active == True)
    )
    total = result.scalar() or 0
    
    # Active today (not off-duty)
    result = await db.execute(
        select(func.count(Staff.staff_id))
        .where(Staff.is_active == True)
        .where(Staff.status != StaffStatus.OFF_DUTY)
    )
    active_today = result.scalar() or 0
    
    # En route
    result = await db.execute(
        select(func.count(Staff.staff_id))
        .where(Staff.status == StaffStatus.EN_ROUTE)
    )
    en_route = result.scalar() or 0
    
    return StaffStats(
        total_staff=total,
        active_today=active_today,
        en_route=en_route,
        completed_orders=0,  # TODO: Calculate from purchase lists
    )


@router.get("/{staff_id}", response_model=StaffWithStats)
async def get_staff_member(
    staff_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get single staff member by ID"""
    result = await db.execute(
        select(Staff).where(Staff.staff_id == staff_id)
    )
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    return StaffWithStats(
        staff_id=staff.staff_id,
        staff_name=staff.staff_name,
        staff_code=staff.staff_code,
        email=staff.email,
        phone=staff.phone,
        role=staff.role,
        status=staff.status,
        start_location_name=staff.start_location_name,
        max_daily_capacity=staff.max_daily_capacity,
        is_active=staff.is_active,
        current_location_name=staff.current_location_name,
        created_at=staff.created_at,
        assigned_orders=0,
        assigned_stores=0,
        completed_today=0,
    )


@router.post("/", response_model=StaffResponse)
async def create_staff(
    staff_data: StaffCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new staff member"""
    import hashlib
    
    staff = Staff(
        staff_name=staff_data.staff_name,
        staff_code=staff_data.staff_code,
        email=staff_data.email,
        phone=staff_data.phone,
        role=staff_data.role,
        start_location_name=staff_data.start_location_name,
        max_daily_capacity=staff_data.max_daily_capacity,
        is_active=True,
        status=StaffStatus.OFF_DUTY,
    )
    
    if staff_data.password:
        staff.password_hash = hashlib.sha256(staff_data.password.encode()).hexdigest()
    
    db.add(staff)
    await db.flush()
    await db.refresh(staff)
    
    return staff


@router.patch("/{staff_id}/status")
async def update_staff_status(
    staff_id: int,
    update: StaffStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update staff status and location"""
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    staff.status = update.status
    if update.current_location_name:
        staff.current_location_name = update.current_location_name
    if update.current_location_lat:
        staff.current_location_lat = update.current_location_lat
    if update.current_location_lng:
        staff.current_location_lng = update.current_location_lng
    
    return {"message": "ステータスを更新しました", "new_status": update.status.value}


@router.post("/{staff_id}/auto-assign")
async def auto_assign_orders(
    staff_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Auto-assign pending orders to a staff member"""
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    # TODO: Implement auto-assignment logic
    return {"message": "自動割当を実行しました", "assigned_count": 0}
