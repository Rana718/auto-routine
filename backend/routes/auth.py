from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from models.auth import LoginRequest, TokenResponse, UserResponse, CreateAdminRequest, UpdateEmailRequest, UpdatePasswordRequest
from middlewares.auth import get_current_user
from controllers.auth import login_user, create_admin_user, get_current_user_info, update_user_email, update_user_password

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_user(request, db)

@router.post("/create-admin", response_model=UserResponse)
async def create_admin(request: CreateAdminRequest, db: AsyncSession = Depends(get_db)):
    """Create admin user with secret key - no authentication required"""
    return await create_admin_user(
        email=request.email,
        password=request.password,
        name=request.name,
        secret_key=request.secret_key,
        db=db
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[Staff, Depends(get_current_user)]):
    return await get_current_user_info(current_user)

@router.patch("/me/email")
async def change_email(
    request: UpdateEmailRequest,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update current user's email address"""
    return await update_user_email(current_user, request.new_email, request.password, db)

@router.patch("/me/password")
async def change_password(
    request: UpdatePasswordRequest,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update current user's password"""
    return await update_user_password(current_user, request.current_password, request.new_password, db)
