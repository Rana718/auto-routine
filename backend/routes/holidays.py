"""
Holiday Management Routes
CRUD endpoints for holiday calendar
"""

from datetime import date
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from db.db import get_db
from db.schema import Staff, Holiday, StaffRole
from middlewares.auth import get_current_user
from middlewares.rbac import require_role

router = APIRouter()


class HolidayCreate(BaseModel):
    holiday_date: date
    holiday_name: Optional[str] = None
    is_working: bool = False


class HolidayResponse(BaseModel):
    holiday_id: int
    holiday_date: date
    holiday_name: Optional[str]
    is_working: bool


@router.get("", response_model=List[HolidayResponse])
async def get_holidays(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = None
):
    """Get all holidays, optionally filtered by year"""
    query = select(Holiday).order_by(Holiday.holiday_date)
    
    if year:
        query = query.where(extract('year', Holiday.holiday_date) == year)
    
    result = await db.execute(query)
    holidays = result.scalars().all()
    
    return [
        HolidayResponse(
            holiday_id=h.holiday_id,
            holiday_date=h.holiday_date,
            holiday_name=h.holiday_name,
            is_working=h.is_working
        )
        for h in holidays
    ]


@router.post("", response_model=HolidayResponse)
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def create_holiday(
    data: HolidayCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new holiday"""
    # Check if holiday already exists
    result = await db.execute(
        select(Holiday).where(Holiday.holiday_date == data.holiday_date)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="この日付は既に登録されています")
    
    holiday = Holiday(
        holiday_date=data.holiday_date,
        holiday_name=data.holiday_name,
        is_working=data.is_working
    )
    db.add(holiday)
    await db.commit()
    await db.refresh(holiday)
    
    return HolidayResponse(
        holiday_id=holiday.holiday_id,
        holiday_date=holiday.holiday_date,
        holiday_name=holiday.holiday_name,
        is_working=holiday.is_working
    )


@router.patch("/{holiday_id}")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def update_holiday(
    holiday_id: int,
    data: HolidayCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update a holiday"""
    result = await db.execute(
        select(Holiday).where(Holiday.holiday_id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    
    if not holiday:
        raise HTTPException(status_code=404, detail="休日が見つかりません")
    
    holiday.holiday_date = data.holiday_date
    holiday.holiday_name = data.holiday_name
    holiday.is_working = data.is_working
    
    await db.commit()
    return {"message": "休日を更新しました"}


@router.delete("/{holiday_id}")
@require_role(StaffRole.ADMIN)
async def delete_holiday(
    holiday_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete a holiday"""
    result = await db.execute(
        select(Holiday).where(Holiday.holiday_id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    
    if not holiday:
        raise HTTPException(status_code=404, detail="休日が見つかりません")
    
    await db.delete(holiday)
    await db.commit()
    
    return {"message": "休日を削除しました"}


@router.post("/import-japan-holidays")
@require_role(StaffRole.ADMIN)
async def import_japan_holidays(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    year: int = None
):
    """Import Japan public holidays for a year"""
    from utils.timezone import jst_year

    target_year = year or jst_year()
    
    # Japan public holidays (approximate - some vary by year)
    japan_holidays = [
        (dt_date(target_year, 1, 1), "元日"),
        (dt_date(target_year, 1, 13), "成人の日"),  # 2nd Monday of January
        (dt_date(target_year, 2, 11), "建国記念の日"),
        (dt_date(target_year, 2, 23), "天皇誕生日"),
        (dt_date(target_year, 3, 21), "春分の日"),  # Around March 20-21
        (dt_date(target_year, 4, 29), "昭和の日"),
        (dt_date(target_year, 5, 3), "憲法記念日"),
        (dt_date(target_year, 5, 4), "みどりの日"),
        (dt_date(target_year, 5, 5), "こどもの日"),
        (dt_date(target_year, 7, 21), "海の日"),  # 3rd Monday of July
        (dt_date(target_year, 8, 11), "山の日"),
        (dt_date(target_year, 9, 16), "敬老の日"),  # 3rd Monday of September
        (dt_date(target_year, 9, 23), "秋分の日"),  # Around September 22-23
        (dt_date(target_year, 10, 14), "スポーツの日"),  # 2nd Monday of October
        (dt_date(target_year, 11, 3), "文化の日"),
        (dt_date(target_year, 11, 23), "勤労感謝の日"),
    ]
    
    imported_count = 0
    for holiday_date, holiday_name in japan_holidays:
        result = await db.execute(
            select(Holiday).where(Holiday.holiday_date == holiday_date)
        )
        if not result.scalar_one_or_none():
            holiday = Holiday(
                holiday_date=holiday_date,
                holiday_name=holiday_name,
                is_working=False
            )
            db.add(holiday)
            imported_count += 1
    
    await db.commit()
    return {"message": f"{imported_count}件の祝日をインポートしました", "year": target_year}
