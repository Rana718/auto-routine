from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Staff, StaffRole, StaffStatus
from models.auth import LoginRequest, TokenResponse, RegisterRequest, UserResponse
from middlewares.auth import hash_password, verify_password, create_token

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

async def register_user(request: RegisterRequest, db: AsyncSession) -> UserResponse:
    result = await db.execute(select(Staff).where(Staff.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています",
        )
    
    user = Staff(
        staff_name=request.name,
        email=request.email,
        password_hash=hash_password(request.password),
        role=StaffRole.BUYER,
        status=StaffStatus.OFF_DUTY,
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
