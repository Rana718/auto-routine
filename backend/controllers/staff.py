from typing import List
from fastapi import HTTPException
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import date

from db.schema import Staff, StaffRole, StaffStatus, StaffCreate, StaffResponse, PurchaseList, ListStatus
from models.staff import StaffStats, StaffWithStats, StaffStatusUpdate
from middlewares.auth import hash_password

async def get_all_staff(db: AsyncSession, active_only: bool, skip: int, limit: int) -> List[StaffWithStats]:
    query = select(Staff)
    if active_only:
        query = query.where(Staff.is_active == True)
    
    query = query.order_by(Staff.staff_name).offset(skip).limit(limit)
    result = await db.execute(query)
    staff_list = result.scalars().all()
    
    if not staff_list:
        return []
    
    # OPTIMIZED: Single query with all aggregations using CASE
    staff_ids = [s.staff_id for s in staff_list]
    today = date.today()
    
    stats_query = select(
        PurchaseList.staff_id,
        func.count(PurchaseList.list_id).label('total_lists'),
        func.sum(case((PurchaseList.list_status == ListStatus.COMPLETED, 1), else_=0)).label('completed_lists'),
        func.sum(PurchaseList.total_stores).label('unique_stores')
    ).where(
        PurchaseList.staff_id.in_(staff_ids),
        PurchaseList.purchase_date == today
    ).group_by(PurchaseList.staff_id)
    
    stats_result = await db.execute(stats_query)
    stats_map = {
        row.staff_id: {
            'assigned': row.total_lists,
            'completed': row.completed_lists,
            'stores': row.unique_stores or 0
        }
        for row in stats_result.all()
    }
    
    return [
        StaffWithStats(
            staff_id=s.staff_id,
            staff_name=s.staff_name,
            staff_code=s.staff_code,
            email=s.email,
            role=s.role.value,
            status=s.status.value,
            is_active=s.is_active,
            assigned_orders=stats_map.get(s.staff_id, {}).get('assigned', 0),
            assigned_stores=stats_map.get(s.staff_id, {}).get('stores', 0),
            completed_today=stats_map.get(s.staff_id, {}).get('completed', 0),
            current_location_name=s.current_location_name,
        )
        for s in staff_list
    ]

async def get_staff_statistics(db: AsyncSession) -> StaffStats:
    # OPTIMIZED: Single query with conditional aggregations
    query = select(
        func.count(Staff.staff_id).label('total'),
        func.sum(case(
            (and_(Staff.is_active == True, Staff.status != StaffStatus.OFF_DUTY), 1),
            else_=0
        )).label('active_today'),
        func.sum(case((Staff.status == StaffStatus.EN_ROUTE, 1), else_=0)).label('en_route')
    ).where(Staff.is_active == True)
    
    result = await db.execute(query)
    row = result.one()
    
    return StaffStats(
        total_staff=row.total or 0,
        active_today=row.active_today or 0,
        en_route=row.en_route or 0,
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
    
    return {"message": "ステータスを更新しました", "new_status": update.status}

async def auto_assign_orders_controller(db: AsyncSession, staff_id: int):
    from services.staff_assignment import assign_to_specific_staff
    from datetime import date
    
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    
    assignment_result = await assign_to_specific_staff(db, staff_id, date.today())
    return assignment_result
