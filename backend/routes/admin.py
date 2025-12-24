from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff, StaffRole, StaffStatus
from models.staff import StaffUpdate, StaffRoleUpdate
from middlewares.auth import get_current_user, hash_password
from middlewares.rbac import require_role

router = APIRouter()

@router.post("/users")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def create_user(
    user_data: dict,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create new user (admin/supervisor only)"""
    from middlewares.auth import hash_password
    
    # Check if email exists
    result = await db.execute(select(Staff).where(Staff.email == user_data["email"]))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="このメールアドレスは既に登録されています")
    
    # Create user
    user = Staff(
        staff_name=user_data["name"],
        email=user_data["email"],
        password_hash=hash_password(user_data["password"]),
        role=StaffRole(user_data.get("role", "buyer")),
        status=StaffStatus.OFF_DUTY,
        is_active=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {
        "message": "ユーザーを作成しました",
        "staff_id": user.staff_id
    }

@router.get("/users")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def get_all_users(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    include_inactive: bool = False
):
    """Get all users (admin/supervisor only)"""
    query = select(Staff)
    if not include_inactive:
        query = query.where(Staff.is_active == True)
    
    result = await db.execute(query.order_by(Staff.created_at.desc()))
    users = result.scalars().all()
    
    return [
        {
            "staff_id": u.staff_id,
            "staff_name": u.staff_name,
            "email": u.email,
            "role": u.role.value,
            "status": u.status.value,
            "is_active": u.is_active,
            "created_at": u.created_at
        }
        for u in users
    ]

@router.patch("/users/{user_id}/role")
@require_role(StaffRole.ADMIN)
async def update_user_role(
    user_id: int,
    update: StaffRoleUpdate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update user role (admin only)"""
    result = await db.execute(select(Staff).where(Staff.staff_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    user.role = StaffRole(update.role)
    await db.commit()
    
    return {"message": "ロールを更新しました"}

@router.patch("/users/{user_id}/activate")
@require_role(StaffRole.ADMIN)
async def toggle_user_active(
    user_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    active: bool = True
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
    if user_id == current_user.staff_id:
        raise HTTPException(status_code=400, detail="自分自身を削除できません")
    
    result = await db.execute(select(Staff).where(Staff.staff_id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "ユーザーを削除しました"}
