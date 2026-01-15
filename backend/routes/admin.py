from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from db.db import get_db
from db.schema import Staff, StaffRole, StaffStatus, StaffResponse, StaffCreate
from middlewares.auth import get_current_user, hash_password
from middlewares.rbac import require_role

router = APIRouter()

class RoleUpdateRequest(BaseModel):
    role: StaffRole

@router.get("/users", response_model=List[StaffResponse])
@require_role(StaffRole.ADMIN)
async def get_all_users(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    include_inactive: bool = False
):
    """Get all users (admin only)"""
    query = select(Staff)
    if not include_inactive:
        query = query.where(Staff.is_active == True)
    
    # Filter out current user from the list
    query = query.where(Staff.staff_id != current_user.staff_id)
    
    result = await db.execute(query.order_by(Staff.created_at.desc()))
    users = result.scalars().all()
    return users

@router.post("/users", response_model=StaffResponse)
@require_role(StaffRole.ADMIN)
async def create_user(
    user_data: StaffCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create new user (admin only)"""
    # Check if email already exists
    result = await db.execute(select(Staff).where(Staff.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="このメールアドレスは既に登録されています")
    
    # Create new user
    new_user = Staff(
        staff_name=user_data.staff_name,
        staff_code=user_data.staff_code,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        status=StaffStatus.OFF_DUTY,
        is_active=True,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.patch("/users/{user_id}/role")
@require_role(StaffRole.ADMIN)
async def update_user_role(
    user_id: int,
    request: RoleUpdateRequest,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update user role (admin only)"""
    result = await db.execute(select(Staff).where(Staff.staff_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    if user.staff_id == current_user.staff_id:
        raise HTTPException(status_code=400, detail="自分自身の権限を変更できません")
    
    user.role = request.role
    await db.commit()
    
    return {"message": f"ユーザー権限を{request.role.value}に変更しました"}

@router.patch("/users/{user_id}/activate")
@require_role(StaffRole.ADMIN)
async def toggle_user_active(
    user_id: int,
    active: bool,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Activate/deactivate user (admin only)"""
    result = await db.execute(select(Staff).where(Staff.staff_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    if user.staff_id == current_user.staff_id:
        raise HTTPException(status_code=400, detail="自分自身を無効化できません")
    
    user.is_active = active
    if not active:
        user.status = StaffStatus.OFF_DUTY
    
    await db.commit()
    
    return {"message": f"ユーザーを{'有効化' if active else '無効化'}しました"}

@router.delete("/users/{user_id}")
@require_role(StaffRole.ADMIN)
async def delete_user(
    user_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete user (admin only)"""
    result = await db.execute(select(Staff).where(Staff.staff_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    if user.staff_id == current_user.staff_id:
        raise HTTPException(status_code=400, detail="自分自身を削除できません")
    
    # Hard delete - actually remove from database
    await db.delete(user)
    await db.commit()
    
    return {"message": "ユーザーを削除しました"}
