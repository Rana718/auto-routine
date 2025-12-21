from typing import Annotated
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff
from models.auth import TokenResponse, RegisterRequest, UserResponse
from middlewares.auth import get_current_user
from controllers.auth import login_user, register_user, get_current_user_info

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    return await login_user(form_data, db)

@router.post("/register", response_model=UserResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await register_user(request, db)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[Staff, Depends(get_current_user)]):
    return await get_current_user_info(current_user)
