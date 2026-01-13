from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Staff, StaffRole, StaffStatus
from models.auth import LoginRequest, TokenResponse, UserResponse
from middlewares.auth import hash_password, verify_password, create_token
from config.env import settings

async def login_user(request: LoginRequest, db: AsyncSession) -> TokenResponse:
    result = await db.execute(select(Staff).where(Staff.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )
    
    token = create_token(user.staff_id)
    
    return TokenResponse(
        access_token=token,
        user={
            "staff_id": user.staff_id,
            "staff_name": user.staff_name,
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
        }
    )

async def create_admin_user(email: str, password: str, name: str, secret_key: str, db: AsyncSession) -> UserResponse:
    """Create admin user with secret key verification"""
    # Verify secret key
    if secret_key != settings.admin_secret_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無効なシークレットキーです",
        )
    
    # Check if email already exists
    result = await db.execute(select(Staff).where(Staff.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています",
        )
    
    # Create admin user
    user = Staff(
        staff_name=name,
        email=email,
        password_hash=hash_password(password),
        role=StaffRole.ADMIN,
        status=StaffStatus.ACTIVE,
        is_active=True,
    )
    
    db.add(user)
    await db.flush()
    await db.refresh(user)
    
    return UserResponse(
        staff_id=user.staff_id,
        staff_name=user.staff_name,
        email=user.email,
        role=user.role.value,
        status=user.status.value,
    )

async def get_current_user_info(current_user: Staff) -> UserResponse:
    return UserResponse(
        staff_id=current_user.staff_id,
        staff_name=current_user.staff_name,
        email=current_user.email,
        role=current_user.role.value,
        status=current_user.status.value,
    )

async def update_user_email(current_user: Staff, new_email: str, password: str, db: AsyncSession) -> dict:
    """Update user's email address with password confirmation"""
    # Verify current password
    if not verify_password(password, current_user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="パスワードが正しくありません",
        )
    
    # Check if new email already exists
    result = await db.execute(select(Staff).where(Staff.email == new_email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user and existing_user.staff_id != current_user.staff_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に使用されています",
        )
    
    # Update email
    current_user.email = new_email
    await db.commit()
    await db.refresh(current_user)
    
    return {"message": "メールアドレスを更新しました", "email": new_email}

async def update_user_password(current_user: Staff, current_password: str, new_password: str, db: AsyncSession) -> dict:
    """Update user's password with current password verification"""
    # Verify current password
    if not verify_password(current_password, current_user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="現在のパスワードが正しくありません",
        )
    
    # Validate new password (at least 6 characters)
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新しいパスワードは6文字以上である必要があります",
        )
    
    # Update password
    current_user.password_hash = hash_password(new_password)
    await db.commit()
    
    return {"message": "パスワードを更新しました"}
