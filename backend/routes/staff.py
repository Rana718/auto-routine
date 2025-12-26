from typing import Annotated, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import StaffCreate, StaffResponse, Staff
from models.staff import StaffStats, StaffWithStats, StaffStatusUpdate
from controllers.staff import *
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[StaffWithStats])
async def get_staff(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    active_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    return await get_all_staff(db, active_only, skip, limit)

@router.get("/stats", response_model=StaffStats)
async def get_stats(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_staff_statistics(db)

@router.get("/{staff_id}", response_model=StaffWithStats)
async def get_staff_member(
    staff_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_staff_by_id(db, staff_id)

@router.post("", response_model=StaffResponse)
async def create_staff(
    staff_data: StaffCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await create_new_staff(db, staff_data)

@router.patch("/{staff_id}/status")
async def update_staff_status(
    staff_id: int,
    update: StaffStatusUpdate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_staff_status_controller(db, staff_id, update)

@router.post("/{staff_id}/auto-assign")
async def auto_assign_orders(
    staff_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await auto_assign_orders_controller(db, staff_id)
