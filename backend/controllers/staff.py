from typing import List
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Staff, StaffRole, StaffStatus, StaffCreate, StaffResponse
from models.staff import StaffStats, StaffWithStats, StaffStatusUpdate
from middlewares.auth import hash_password

async def get_all_staff(db: AsyncSession, active_only: bool, skip: int, limit: int) -> List[StaffWithStats]:
    query = select(Staff)
    if active_only:
        query = query.where(Staff.is_active == True)
    
    query = query.order_by(Staff.staff_name).offset(skip).limit(limit)
    result = await db.execute(query)
    staff_list = result.scalars().all()
    
    return [
        StaffWithStats(
            staff_id=s.staff_id,
            staff_name=s.staff_name,
            staff_code=s.staff_code,
            email=s.email,
            phone=s.phone,
            role=s.role.value,
            status=s.status,
            assigned_orders=0,
            assigned_stores=0,
            completed_today=0,
        )
        for s in staff_list
    ]

async def get_staff_statistics(db: AsyncSession) -> StaffStats:
    result = await db.execute(select(func.count(Staff.staff_id)).where(Staff.is_active == True))
    total = result.scalar() or 0
    
    result = await db.execute(
        select(func.count(Staff.staff_id))
        .where(Staff.is_active == True)
        .where(Staff.status != StaffStatus.OFF_DUTY)
    )
    active_today = result.scalar() or 0
    
    result = await db.execute(select(func.count(Staff.staff_id)).where(Staff.status == StaffStatus.EN_ROUTE))
    en_route = result.scalar() or 0
    
    return StaffStats(
        total_staff=total,
        active_today=active_today,
        en_route=en_route,
        completed_orders=0,
    )

async def get_staff_by_id(db: AsyncSession, staff_id: int) -> StaffWithStats:
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    return StaffWithStats(
        staff_id=staff.staff_id,
        staff_name=staff.staff_name,
        staff_code=staff.staff_code,
        email=staff.email,
        phone=staff.phone,
        role=staff.role.value,
        status=staff.status,
        assigned_orders=0,
        assigned_stores=0,
        completed_today=0,
    )

async def create_new_staff(db: AsyncSession, staff_data: StaffCreate) -> StaffResponse:
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
        staff.password_hash = hash_password(staff_data.password)
    
    db.add(staff)
    await db.flush()
    await db.refresh(staff)
    return staff

async def update_staff_status_controller(db: AsyncSession, staff_id: int, update: StaffStatusUpdate):
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

async def auto_assign_orders_controller(db: AsyncSession, staff_id: int):
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    return {"message": "自動割当を実行しました", "assigned_count": 0}
